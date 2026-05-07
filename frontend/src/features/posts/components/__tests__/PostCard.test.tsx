import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/handlers'
import PostCard from '../PostCard'
import type { Post } from '@/shared/types/Types'

const BASE_POST: Post = {
  post_id: 1,
  caption: 'Test caption',
  image_paths: ['https://cdn.example.com/img.jpg'],
  total_likes: 5,
  public: true,
  is_published: true,
  type: 'collection',
  updated_at: '2026-01-01T00:00:00Z',
  is_liked: false,
  user: { user_id: 99, username: 'alice', avatar_path: null },
}

function renderCard(overrides: Partial<typeof BASE_POST> = {}, extraProps: Record<string, unknown> = {}) {
  const post = { ...BASE_POST, ...overrides }
  return render(
    <MemoryRouter>
      <PostCard
        post={post}
        imagePath={post.image_paths[0] ?? null}
        imageIndex={0}
        {...extraProps}
      />
    </MemoryRouter>
  )
}

function setSession(userId = '1') {
  localStorage.setItem('userId', userId)
  localStorage.setItem('username', 'testuser')
  localStorage.setItem('email', 'test@example.com')
  localStorage.setItem('role', 'user')
}

function clearSession() {
  ;['userId', 'username', 'email', 'role'].forEach((k) => localStorage.removeItem(k))
}

describe('PostCard', () => {
  it('renders the image when imagePath is provided', () => {
    renderCard()
    const img = screen.getByRole('img', { name: /test caption/i })
    expect(img).toBeTruthy()
    expect((img as HTMLImageElement).src).toContain('img.jpg')
  })

  it('renders the placeholder when imagePath is null', () => {
    const { container } = render(
      <MemoryRouter>
        <PostCard post={BASE_POST} imagePath={null} imageIndex={0} />
      </MemoryRouter>
    )
    expect(screen.queryByRole('img', { name: /test caption/i })).toBeNull()
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('calls onClick when the card is clicked', () => {
    const onClick = vi.fn()
    renderCard({}, { onClick })
    fireEvent.click(screen.getByRole('img', { name: /test caption/i }))
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ post_id: 1 }), 0)
  })

  it('does not call onClick when the like button is clicked', async () => {
    setSession()
    server.use(
      http.post('http://localhost:8000/posts/like_image', () =>
        HttpResponse.json({ message: 'Liked' })
      )
    )
    const onClick = vi.fn()
    renderCard({}, { onClick })
    fireEvent.click(screen.getByRole('button', { name: /like post/i }))
    expect(onClick).not.toHaveBeenCalled()
    clearSession()
  })

  describe('authenticated user', () => {
    beforeEach(() => setSession())
    afterEach(() => clearSession())

    it('calls onLikeToggle after a successful like', async () => {
      server.use(
        http.post('http://localhost:8000/posts/like_image', () =>
          HttpResponse.json({ message: 'Liked' })
        )
      )
      const onLikeToggle = vi.fn()
      renderCard({}, { onLikeToggle })
      fireEvent.click(screen.getByRole('button', { name: /like post/i }))
      await waitFor(() => expect(onLikeToggle).toHaveBeenCalledWith(1, true))
    })

    it('rolls back the like count when the API returns an error', async () => {
      server.use(
        http.post('http://localhost:8000/posts/like_image', () =>
          HttpResponse.json({ message: 'Error' }, { status: 500 })
        )
      )
      renderCard({ total_likes: 5, is_liked: false })
      fireEvent.click(screen.getByRole('button', { name: /like post/i }))
      await waitFor(() => expect(screen.getByText('5')).toBeTruthy())
    })
  })

  describe('guest user (no session)', () => {
    beforeEach(() => clearSession())

    it('opens the auth wall instead of liking when no session', async () => {
      const onLikeToggle = vi.fn()
      renderCard({}, { onLikeToggle })
      fireEvent.click(screen.getByRole('button', { name: /like post/i }))
      // guard() short-circuits — onLikeToggle is never called
      await waitFor(() => expect(onLikeToggle).not.toHaveBeenCalled())
    })
  })
})
