import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

const mockPost = {
  post_id: 1,
  caption: 'Test post',
  public: true,
  is_published: true,
  type: 'collection',
  updated_at: '2026-01-01T00:00:00Z',
  is_liked: false,
  total_likes: 0,
  images: [{ paths: { original: 'https://cdn.example.com/img.jpg', medium: 'https://cdn.example.com/img-m.jpg' }, original_width: 400, original_height: 300 }],
  user: { user_id: 1, username: 'alice', avatar_path: null },
}

export const handlers = [
  // Auth
  http.post('http://localhost:8000/users/login', () => {
    return HttpResponse.json({
      user: { id: 1, username: 'testuser', email: 'test@example.com' },
    })
  }),

  // Current user
  http.get('http://localhost:8000/users/me', () => {
    return HttpResponse.json({
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      bio: null,
      avatar_path: null,
      background_path: null,
      background_offset_x: 0,
      background_offset_y: 0,
      background_scale: 1,
    })
  }),
  http.patch('http://localhost:8000/users/me/profile', () => {
    return HttpResponse.json({
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      bio: null,
      avatar_path: null,
    })
  }),
  http.post('http://localhost:8000/users/me/avatar', () => {
    return HttpResponse.json({ avatar_path: 'Uploads/1/thumbnail/new.jpg' })
  }),
  http.post('http://localhost:8000/users/me/password', () => {
    return HttpResponse.json({})
  }),

  // Public feed (optional-auth)
  http.get('http://localhost:8000/posts/top', () => {
    return HttpResponse.json({
      posts: [mockPost],
      next_cursor: null,
    })
  }),

  // Public profile (optional-auth)
  http.post('http://localhost:8000/users/get_user_', () => {
    return HttpResponse.json({
      user_id: 1,
      username: 'alice',
      bio: null,
      avatar_path: null,
      background_path: null,
      background_offset_x: 0,
      background_offset_y: 0,
      background_scale: 1,
      sticker_count: 0,
      is_owner: false,
      posts: [mockPost],
    })
  }),

  // Public folder list (optional-auth)
  http.get('http://localhost:8000/folders/user/:username', () => {
    return HttpResponse.json([])
  }),

  // Public folder detail (optional-auth)
  http.get('http://localhost:8000/folders/:folderId', () => {
    return HttpResponse.json({
      id: 1,
      user_id: 1,
      name: 'Test Folder',
      description: null,
      cover_post_id: null,
      avatar_path: null,
      is_public: true,
      folder_type: 'collection',
      posts: [],
    })
  }),

  // Library
  http.get('http://localhost:8000/library/', ({ request }) => {
    const url = new URL(request.url)
    const search = url.searchParams.get('search')

    const stickers = [
      { id: 1, title: 'Blue Petr', petr_dropper: 'Alice', drop_date: '2026', thumbnail: 'thumb1.jpg' },
      { id: 2, title: 'Red Petr', petr_dropper: 'Bob', drop_date: '2025', thumbnail: 'thumb2.jpg' },
    ]

    if (search) {
      return HttpResponse.json(stickers.filter(s => s.title.toLowerCase().includes(search.toLowerCase())))
    }
    return HttpResponse.json(stickers)
  }),
  http.get('http://localhost:8000/library/:id', ({ params }) => {
    return HttpResponse.json({
      id: Number(params.id),
      title: params.id === '1' ? 'Blue Petr' : 'Red Petr',
      petr_dropper: 'Some Dropper',
      drop_date: '2026',
      description: 'Test description',
      images: [{ paths: { medium: 'medium.jpg' } }],
      created_at: '2026-04-19T12:00:00Z',
      added_by: 'testuser'
    })
  }),
  http.post('http://localhost:8000/library/upload', () => {
    return HttpResponse.json({ id: 3, message: 'Success' })
  }),
]

export const server = setupServer(...handlers)
