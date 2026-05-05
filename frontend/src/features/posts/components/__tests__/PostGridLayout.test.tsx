import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PostGridLayout from '../PostGridLayout'
import type { GridItem } from '@/shared/types/Types'

const POST_ITEM: GridItem = {
  kind: 'post',
  data: {
    post_id: 1,
    caption: 'Post one',
    image_paths: ['https://cdn.example.com/img.jpg'],
    total_likes: 0,
    public: true,
    is_published: true,
    type: 'collection',
    updated_at: '2026-01-01T00:00:00Z',
    is_liked: false,
    user: { user_id: 1, username: 'alice', avatar_path: null },
  },
}

const FOLDER_ITEM: GridItem = {
  kind: 'folder',
  data: {
    id: 10,
    user_id: 1,
    name: 'My Folder',
    description: null,
    cover_post_id: null,
    avatar_path: null,
    is_public: true,
    folder_type: 'collection',
    post_count: 3,
    preview_images: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
}

function renderGrid(items: GridItem[]) {
  return render(
    <MemoryRouter>
      <PostGridLayout items={items} />
    </MemoryRouter>
  )
}

describe('PostGridLayout', () => {
  it('renders empty-state message when items array is empty', () => {
    renderGrid([])
    expect(screen.getByText('No posts yet')).toBeTruthy()
  })

  it('renders empty-state message when items is undefined', () => {
    renderGrid(undefined as unknown as GridItem[])
    expect(screen.getByText('No posts yet')).toBeTruthy()
  })

  it('container uses CSS multi-column classes, not grid', () => {
    const { container } = renderGrid([POST_ITEM])
    const masonry = container.querySelector('div.columns-2')
    expect(masonry).toBeTruthy()
    expect(masonry?.classList.contains('grid')).toBe(false)
  })

  it('each item wrapper has break-inside-avoid class', () => {
    const { container } = renderGrid([POST_ITEM, FOLDER_ITEM])
    const wrappers = container.querySelectorAll('div.break-inside-avoid')
    expect(wrappers.length).toBe(2)
  })

  it('renders an img for a post item', () => {
    renderGrid([POST_ITEM])
    expect(screen.getByRole('img', { name: /post one/i })).toBeTruthy()
  })

  it('renders a folder card with data-testid for a folder item', () => {
    renderGrid([FOLDER_ITEM])
    expect(screen.getByTestId('folder-card')).toBeTruthy()
  })

  it('renders the correct number of item wrappers', () => {
    const secondPost: GridItem = { kind: 'post', data: { ...POST_ITEM.data, post_id: 2 } }
    const { container } = renderGrid([POST_ITEM, FOLDER_ITEM, secondPost])
    expect(container.querySelectorAll('div.break-inside-avoid').length).toBe(3)
  })
})
