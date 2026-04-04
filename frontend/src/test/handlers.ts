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
]

export const server = setupServer(...handlers)
