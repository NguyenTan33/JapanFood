import assert from 'node:assert/strict';

export const PAYMENT_METHODS = {
  FULL_BANK: 'FullBank',
  COD_50_DEPOSIT: 'Cod50Deposit',
};

export const PAYMENT_GATEWAYS = {
  CASH: 'Cash',
  VIET_QR: 'VietQR',
  VNPAY: 'VnPay',
  MOMO: 'MoMo',
  ZALOPAY: 'ZaloPay',
};

export const ORDER_TYPES = {
  DINE_IN: 'DineIn',
  TAKEAWAY: 'Takeaway',
  DELIVERY: 'Delivery',
};

export const ORDER_STATUSES = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  IN_PREPARATION: 'InPreparation',
  SERVED: 'Served',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

function normalizeDiscountType(discountType) {
  return String(discountType || '').trim().toLowerCase();
}

/**
 * Matches server Order.RecalculateTotals() in F&B/Domain/Entities/Menu/Order.cs:
 *   SubTotal = sum((basePrice + modifierAdjustments) * quantity)
 *   TaxAmount = Math.round(SubTotal * 0.08)
 *   TotalAmount = Math.max(0, SubTotal + TaxAmount - DiscountAmount)
 */
export function calculateServerOrderTotals(items, paymentMethod, voucher = null) {
  if (!items || items.length === 0) {
    throw new Error('Order must contain at least one item');
  }

  const subTotal = items.reduce((acc, item) => {
    const modifiers = item.modifiers || item.selectedModifiers || item.selectedOptions || [];
    const modifierSum = modifiers.reduce(
      (mAcc, m) => mAcc + (m.priceAdjustment ?? m.price ?? 0) * (m.quantity ?? 1),
      0
    );
    const unitPrice = (item.basePrice ?? item.price ?? 0) + modifierSum;
    return acc + unitPrice * (item.quantity || 1);
  }, 0);

  const taxAmount = Math.round(subTotal * 0.08);
  let discountAmount = 0;

  if (voucher && voucher.isActive !== false) {
    if (voucher.minOrderAmount && subTotal < voucher.minOrderAmount) {
      throw new Error(`Đơn hàng tối thiểu ${voucher.minOrderAmount.toLocaleString('vi-VN')}₫ để sử dụng mã này`);
    }
    const type = normalizeDiscountType(voucher.discountType);
    if (type === 'percentage') {
      discountAmount = Math.round(subTotal * (voucher.discountValue / 100));
      if (voucher.maxDiscountAmount) {
        discountAmount = Math.min(discountAmount, voucher.maxDiscountAmount);
      }
    } else if (type === 'fixedamount' || type === 'fixed_amount') {
      discountAmount = Math.min(voucher.discountValue, subTotal);
    } else {
      throw new Error(`Unsupported discountType "${voucher.discountType}". Expected Percentage or FixedAmount.`);
    }
  }

  const totalAmount = Math.max(0, subTotal + taxAmount - discountAmount);

  let depositRate;
  let depositAmount;
  let remainingCodAmount;

  if (paymentMethod === PAYMENT_METHODS.FULL_BANK) {
    depositRate = 1.0;
    depositAmount = totalAmount;
    remainingCodAmount = 0;
  } else if (paymentMethod === PAYMENT_METHODS.COD_50_DEPOSIT) {
    depositRate = 0.5;
    depositAmount = Math.round(totalAmount * 0.5);
    remainingCodAmount = totalAmount - depositAmount;
  } else {
    throw new Error(
      `STRICT PAYMENT ENFORCEMENT ERROR: Unauthorized payment method "${paymentMethod}". Only FullBank or Cod50Deposit are allowed.`
    );
  }

  return {
    subTotal,
    subtotal: subTotal,
    taxAmount,
    vatAmount: taxAmount,
    discountAmount,
    totalAmount,
    paymentMethod,
    depositRate,
    depositAmount,
    remainingCodAmount,
  };
}

export const calculateOrderPricing = calculateServerOrderTotals;

export function generateVietQrUrl({
  bankConfig,
  bankId,
  accountNumber,
  accountName,
  depositAmount,
  orderCode,
}) {
  const resolvedBankId = bankId || bankConfig?.bankId;
  const resolvedAccountNo = accountNumber || bankConfig?.accountNumber;
  const resolvedAccountName = accountName || bankConfig?.accountName;

  assert.ok(resolvedBankId, 'Dynamic bankId from /api/restaurant-info BankConfig is required');
  assert.ok(resolvedAccountNo, 'Dynamic accountNumber from /api/restaurant-info BankConfig is required');
  assert.ok(resolvedAccountName, 'Dynamic accountName from /api/restaurant-info BankConfig is required');
  assert.ok(depositAmount > 0, 'Deposit amount for VietQR must be greater than 0');
  assert.ok(orderCode, 'Order code for VietQR memo is required');

  const memo = encodeURIComponent(orderCode);
  const name = encodeURIComponent(resolvedAccountName);
  return `https://img.vietqr.io/image/${resolvedBankId}-${resolvedAccountNo}-compact2.png?amount=${depositAmount}&addInfo=${memo}&accountName=${name}`;
}

export function assertStrictDepositPolicy(order) {
  assert.ok(order.totalAmount > 0, 'Total amount must be positive');
  assert.equal(
    order.depositAmount + order.remainingCodAmount,
    order.totalAmount,
    'Invariant broken: depositAmount + remainingCodAmount must strictly equal totalAmount'
  );

  if (order.paymentMethod === PAYMENT_METHODS.FULL_BANK) {
    assert.equal(order.depositRate, 1.0, 'FullBank deposit rate must be 1.0');
    assert.equal(
      order.depositAmount,
      order.totalAmount,
      'Deposit amount must equal total amount for FullBank'
    );
    assert.equal(order.remainingCodAmount, 0, 'Remaining COD amount must be 0 for FullBank');
  } else if (order.paymentMethod === PAYMENT_METHODS.COD_50_DEPOSIT) {
    assert.equal(order.depositRate, 0.5, 'Cod50Deposit rate must be exactly 0.5');
    const expectedDeposit = Math.round(order.totalAmount * 0.5);
    assert.equal(order.depositAmount, expectedDeposit, 'Deposit amount must be 50% of total');
    assert.equal(
      order.remainingCodAmount,
      order.totalAmount - expectedDeposit,
      'Remaining COD balance must match balance'
    );
  } else {
    assert.fail(`Strict policy rejection: Invalid or unauthorized payment method ${order.paymentMethod}`);
  }
}

export function validateOrderStateTransition(currentStatus, targetStatus) {
  const validTransitions = {
    [ORDER_STATUSES.PENDING]: [ORDER_STATUSES.CONFIRMED, ORDER_STATUSES.CANCELLED],
    [ORDER_STATUSES.CONFIRMED]: [ORDER_STATUSES.IN_PREPARATION, ORDER_STATUSES.CANCELLED],
    [ORDER_STATUSES.IN_PREPARATION]: [ORDER_STATUSES.SERVED, ORDER_STATUSES.COMPLETED, ORDER_STATUSES.CANCELLED],
    [ORDER_STATUSES.SERVED]: [ORDER_STATUSES.COMPLETED],
    [ORDER_STATUSES.COMPLETED]: [],
    [ORDER_STATUSES.CANCELLED]: [],
  };

  const allowed = validTransitions[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    throw new Error(`Invalid status transition from ${currentStatus} to ${targetStatus}`);
  }

  return true;
}
