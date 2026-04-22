import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PostCardOverlay from '../PostCardOverlay'

function makeProps(overrides: Partial<Parameters<typeof PostCardOverlay>[0]> = {}) {
  return {
    postType: 'collection',
    isLiked: false,
    likeCount: 7,
    onLikeClick: vi.fn(),
    isOwner: false,
    onDeleteClick: vi.fn(),
    ...overrides,
  }
}

describe('PostCardOverlay', () => {
  it('renders the correct like count', () => {
    render(<PostCardOverlay {...makeProps({ likeCount: 42 })} />)
    expect(screen.getByText('42')).toBeTruthy()
  })

  it('heart button has filled brick-red class when isLiked is true', () => {
    const { container } = render(<PostCardOverlay {...makeProps({ isLiked: true })} />)
    const heart = container.querySelector('svg.fill-brick-red')
    expect(heart).toBeTruthy()
  })

  it('heart button has fill-none class when isLiked is false', () => {
    const { container } = render(<PostCardOverlay {...makeProps({ isLiked: false })} />)
    expect(container.querySelector('svg.fill-none')).toBeTruthy()
  })

  it('calls onLikeClick when like button is clicked', () => {
    const onLikeClick = vi.fn()
    render(<PostCardOverlay {...makeProps({ onLikeClick })} />)
    fireEvent.click(screen.getByRole('button', { name: /like post/i }))
    expect(onLikeClick).toHaveBeenCalledTimes(1)
  })

  it('renders a type indicator dot for collection', () => {
    const { container } = render(<PostCardOverlay {...makeProps({ postType: 'collection' })} />)
    const dot = container.querySelector('[aria-label="Collectible"]')
    expect(dot).toBeTruthy()
  })

  it('renders a green dot for trading posts', () => {
    const { container } = render(<PostCardOverlay {...makeProps({ postType: 'trading' })} />)
    const dot = container.querySelector('[aria-label="Trading"]')
    expect(dot).toBeTruthy()
    expect(dot?.className).toContain('bg-emerald-500')
  })

  it('renders a blue dot for looking_for posts', () => {
    const { container } = render(<PostCardOverlay {...makeProps({ postType: 'looking_for' })} />)
    const dot = container.querySelector('[aria-label="Looking For"]')
    expect(dot).toBeTruthy()
    expect(dot?.className).toContain('bg-sky-500')
  })

  it('renders no type dot when postType is absent', () => {
    const { container } = render(<PostCardOverlay {...makeProps({ postType: undefined })} />)
    expect(container.querySelector('[aria-label="Collectible"]')).toBeNull()
    expect(container.querySelector('[aria-label="Trading"]')).toBeNull()
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
