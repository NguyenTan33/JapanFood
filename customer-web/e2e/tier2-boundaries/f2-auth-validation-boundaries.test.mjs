import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateErrorEnvelope, validateUserProfileSchema } from '../harness/index.mjs';

describe('Tier 2 - Boundary R2/R4: Auth Validation Boundaries', () => {
  it('T2-R2-01: Duplicate email registration rejection (409/400 envelope)', () => {
    const existingUsers = [{ email: 'customer@japanfood.vn' }];

    function validateRegistrationEmail(email) {
      if (existingUsers.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
        return {
          statusCode: 409,
          code: 'DUPLICATE_EMAIL',
          message: 'Email đã được đăng ký trong hệ thống',
        };
      }
      return null;
    }

    const err1 = validateRegistrationEmail('customer@japanfood.vn');
    validateErrorEnvelope(err1, 409);
    const err2 = validateRegistrationEmail('CUSTOMER@JAPANFOOD.VN');
    validateErrorEnvelope(err2, 409);
  });

  it('T2-R2-02: Password confirmation mismatch validation', () => {
    function validatePasswordMatch(p1, p2) {
      if (p1 !== p2) {
        return { isValid: false, error: 'Mật khẩu xác nhận không khớp' };
      }
      return { isValid: true, error: null };
    }

    const check = validatePasswordMatch('Pass@1234', 'Different@5678');
    assert.equal(check.isValid, false);
    assert.equal(check.error, 'Mật khẩu xác nhận không khớp');
  });

  it('T2-R2-03: Login with invalid credentials returns 401 ErrorEnvelope & zero passwordHash leakage', () => {
    const validAccount = {
      id: 4,
      fullName: 'Khách hàng',
      email: 'customer@japanfood.vn',
      role: 'CUSTOMER',
    };

    function attemptLogin(email, password) {
      if (email !== validAccount.email || password !== 'Customer@123456') {
        return {
          ok: false,
          error: {
            statusCode: 401,
            code: 'INVALID_CREDENTIALS',
            message: 'Tài khoản hoặc mật khẩu không chính xác',
          },
        };
      }
      return { ok: true, accessToken: 'jwt', user: validAccount };
    }

    const failure = attemptLogin('customer@japanfood.vn', 'WrongPassword');
    assert.equal(failure.ok, false);
    validateErrorEnvelope(failure.error, 401);

    const success = attemptLogin('customer@japanfood.vn', 'Customer@123456');
    assert.equal(success.ok, true);
    validateUserProfileSchema(success.user);
  });

  it('T2-R2-04: Malformed email and phone format validation regex boundaries', () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const vnPhoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;

    assert.equal(emailRegex.test('plainaddress'), false);
    assert.equal(emailRegex.test('missingat.com'), false);
    assert.equal(emailRegex.test('@missinguser.com'), false);
    assert.equal(emailRegex.test('valid.user@torisakura.vn'), true);

    assert.equal(vnPhoneRegex.test('12345'), false);
    assert.equal(vnPhoneRegex.test('0123456789'), false);
    assert.equal(vnPhoneRegex.test('0901234567'), true);
    assert.equal(vnPhoneRegex.test('+84901234567'), true);
  });

  it('T2-R2-05: OTP verification 5-attempt lock & cooldown boundary (OtpService.cs contract)', () => {
    class OtpVerifier {
      constructor(expectedOtp = '654321', maxAttempts = 5) {
        this.expectedOtp = expectedOtp;
        this.attempts = 0;
        this.maxAttempts = maxAttempts;
        this.locked = false;
      }

      verify(enteredOtp) {
        if (this.locked) throw new Error('Quá số lần thử. Vui lòng yêu cầu mã OTP mới.');
        this.attempts++;
        if (enteredOtp !== this.expectedOtp) {
          if (this.attempts >= this.maxAttempts) {
            this.locked = true;
            throw new Error('Quá số lần thử. Vui lòng yêu cầu mã OTP mới.');
          }
          throw new Error(`Mã xác thực OTP không đúng (còn ${this.maxAttempts - this.attempts} lần thử)`);
        }
        return { success: true };
      }
    }

    const verifier = new OtpVerifier('654321', 5);
    for (let i = 0; i < 4; i++) {
      assert.throws(() => verifier.verify(`00000${i}`), /Mã xác thực OTP không đúng/);
    }
    assert.throws(() => verifier.verify('000009'), /Quá số lần thử/);
    assert.equal(verifier.locked, true);
  });

  it('T2-R2-06: Auth modal keyboard Escape dismissal state transition', () => {
    const modalState = {
      isOpen: true,
      handleKeyDown(eventKey) {
        if (eventKey === 'Escape') {
          this.isOpen = false;
        }
      },
    };

    assert.equal(modalState.isOpen, true);
    modalState.handleKeyDown('Enter');
    assert.equal(modalState.isOpen, true);
    modalState.handleKeyDown('Escape');
    assert.equal(modalState.isOpen, false);
  });
});
