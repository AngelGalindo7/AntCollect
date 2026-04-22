import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PostCardOverlay from '../PostCardOverlay'

function makeProps(overrides: Partial<Parameters<typeof PostCardOverlay>[0]> = {}) {
  return {
    user: { username: 'alice', avatar_path: 'https://cdn.example.com/alice.jpg' },
    isLiked: false,
    likeCount: 7,
    onLikeClick: vi.fn(),
    isOwner: false,
    onDeleteClick: vi.fn(),
    ...overrides,
  }
}

describe('PostCardOverlay', () => {
  it('renders user avatar when avatar_path is provided', () => {
    render(<PostCardOverlay {...makeProps()} />)
    const img = screen.getByRole('img', { name: 'alice' })
    expect(img).toBeTruthy()
    expect((img as HTMLImageElement).src).toContain('alice.jpg')
  })

  it('renders fallback div when avatar_path is null', () => {
    const { container } = render(
      <PostCardOverlay {...makeProps({ user: { username: 'bob', avatar_path: null } })} />
    )
    expect(screen.queryByRole('img', { name: 'bob' })).toBeNull()
    expect(container.querySelector('div.rounded-full.bg-warm-cream')).toBeTruthy()
  })

  it('renders fallback div when user is null', () => {
    const { container } = render(<PostCardOverlay {...makeProps({ user: null })} />)
    expect(container.querySelector('div.rounded-full.bg-warm-cream')).toBeTruthy()
  })

  it('renders the correct like count', () => {
    render(<PostCardOverlay {...makeProps({ likeCount: 42 })} />)
    expect(screen.getByText('42')).toBeTruthy()
  })

  it('heart button has filled red class when isLiked is true', () => {
    const { container } = render(<PostCardOverlay {...makeProps({ isLiked: true })} />)
    const heart = container.querySelector('svg.fill-brick-red')
    expect(heart).toBeTruthy()
  })

  it('heart button has no fill class when isLiked is false', () => {
    const { container } = render(<PostCardOverlay {...makeProps({ isLiked: false })} />)
    expect(container.querySelector('svg.fill-red-500')).toBeNull()
    expect(container.querySelector('svg.fill-none')).toBeTruthy()
  })

  it('calls onLikeClick when like button is clicked', () => {
    const onLikeClick = vi.fn()
    render(<PostCardOverlay {...makeProps({ onLikeClick })} />)
    fireEvent.click(screen.getByRole('button', { name: /like post/i }))
    expect(onLikeClick).toHaveBeenCalledTimes(1)
  })

  it('options button does not propagate clicks', () => {
    const cardClick = vi.fn()
    render(
      <div onClick={cardClick}>
        <PostCardOverlay {...makeProps()} />
      </div>
    )
    const options = screen.getByLabelText('Options')
    fireEvent.click(options)
    expect(cardClick).not.toHaveBeenCalled()
  })

  it('shows delete option only when isOwner is true', () => {
    const { rerender } = render(<PostCardOverlay {...makeProps({ isOwner: false })} />)
    fireEvent.click(screen.getByLabelText('Options'))
    expect(screen.queryByText('Delete Post')).toBeNull()

    rerender(<PostCardOverlay {...makeProps({ isOwner: true })} />)
    // Options menu is still open or needs to be re-opened if component re-mounted
    // Actually rerender keeps state if same component.
    expect(screen.getByText('Delete Post')).toBeTruthy()
  })

  it('calls onDeleteClick when delete button is clicked', () => {
    const onDeleteClick = vi.fn()
    render(<PostCardOverlay {...makeProps({ isOwner: true, onDeleteClick })} />)
    fireEvent.click(screen.getByLabelText('Options'))
    fireEvent.click(screen.getByText('Delete Post'))
    expect(onDeleteClick).toHaveBeenCalledTimes(1)
  })
})
