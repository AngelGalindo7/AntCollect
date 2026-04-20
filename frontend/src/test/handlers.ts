import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

export const handlers = [
  http.get('http://localhost:8000/users/me', () => {
    return HttpResponse.json({
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      bio: null,
      avatar_path: null,
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
  http.post('http://localhost:8000/users/login', () => {
    return HttpResponse.json({
      user: { id: 1, username: 'testuser', email: 'test@example.com' },
    })
  }),
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
