import { apiClient } from './apiClient';
import { BlogPost, BlogCategory } from '@/types';

export interface BlogPostDto {
  id: number;
  slug: string;
  title: string;
  subtitle?: string;
  japaneseSubtitle?: string;
  category: string;
  excerpt?: string;
  content?: string;
  coverImageUrl?: string;
  authorName: string;
  authorRole?: string;
  authorAvatarUrl?: string;
  author?: {
    name: string;
    role?: string;
    avatar?: string;
  };
  publishedAt: string;
  readTimeMinutes: number;
  tags?: string[];
  relatedDishIds?: number[];
}

export const mapBlogPostDto = (dto: BlogPostDto): BlogPost => ({
  id: String(dto.id),
  slug: dto.slug,
  title: dto.title,
  subtitle: dto.subtitle || '',
  japaneseTitle: dto.japaneseSubtitle || '',
  category: (dto.category as BlogCategory) || 'Cuisine Culture',
  author: {
    name: dto.author?.name || dto.authorName || 'Tori Sakura',
    role: dto.author?.role || dto.authorRole || 'Bếp trưởng',
    avatar: dto.author?.avatar || dto.authorAvatarUrl || 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=200&q=80',
  },
  coverImage: dto.coverImageUrl || 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=1200&q=80',
  publishedAt: dto.publishedAt ? new Date(dto.publishedAt).toISOString().split('T')[0] : '',
  readTimeMinutes: dto.readTimeMinutes || 5,
  summary: dto.excerpt || '',
  content: dto.content || '',
  tags: Array.isArray(dto.tags) ? dto.tags : [],
  relatedDishIds: Array.isArray(dto.relatedDishIds) ? dto.relatedDishIds : [],
});

export const blogService = {
  async getBlogs(category?: string): Promise<BlogPost[]> {
    const params = category && category !== 'All' ? { category } : undefined;
    const { data } = await apiClient.get<any>('/blogs', { params });
    const list = Array.isArray(data) ? data : (data?.items || data?.value || []);
    return list.map(mapBlogPostDto);
  },

  async getBlogBySlug(slug: string): Promise<BlogPost | null> {
    try {
      const { data } = await apiClient.get<BlogPostDto>(`/blogs/${slug}`);
      return data ? mapBlogPostDto(data) : null;
    } catch {
      return null;
    }
  },

  async createBlog(payload: Partial<BlogPostDto>): Promise<{ id: number; slug: string }> {
    const { data } = await apiClient.post('/blogs', payload);
    return data;
  },

  async updateBlog(id: number, payload: Partial<BlogPostDto>): Promise<void> {
    await apiClient.put(`/blogs/${id}`, payload);
  },

  async deleteBlog(id: number): Promise<void> {
    await apiClient.delete(`/blogs/${id}`);
  },
};
