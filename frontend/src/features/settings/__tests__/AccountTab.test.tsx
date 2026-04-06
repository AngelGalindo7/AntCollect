import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/handlers'
import AccountTab from '../components/AccountTab'

function renderAccountTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <AccountTab />
      </QueryClientProvider>
    </MemoryRouter>
  )
}

function getPasswordInput(labelPattern: RegExp): HTMLInputElement {
  const label = screen.getByText(labelPattern)
  return label.closest('div')!.querySelector('input')! as HTMLInputElement
}

describe('AccountTab', () => {
  beforeEach(() => {
    localStorage.setItem('email', 'test@example.com')
  })

  it('renders email from localStorage as read-only text (not an input)', () => {
    renderAccountTab()
    expect(screen.getByText('test@example.com')).toBeTruthy()
    expect(screen.queryByDisplayValue('test@example.com')).toBeNull()
  })

  it('fires POST /users/me/password after opening accordion and submitting valid passwords', async () => {
    let passwordFired = false
    server.use(
      http.post('http://localhost:8000/users/me/password', () => {
        passwordFired = true
        return HttpResponse.json({})
      })
    )

    renderAccountTab()
    fireEvent.click(screen.getByRole('button', { name: /change password/i }))

    fireEvent.change(getPasswordInput(/current password/i), { target: { value: 'oldPass1!' } })
    fireEvent.change(getPasswordInput(/^new password$/i), { target: { value: 'NewPass1!' } })
    fireEvent.change(getPasswordInput(/confirm new password/i), { target: { value: 'NewPass1!' } })

    fireEvent.click(screen.getByRole('button', { name: /update password/i }))

    await waitFor(() => expect(passwordFired).toBe(true))
  })

  it('shows "Passwords do not match" without a network call when passwords differ', async () => {
    let passwordFired = false
    server.use(
      http.post('http://localhost:8000/users/me/password', () => {
        passwordFired = true
        return HttpResponse.json({})
      })
    )

    renderAccountTab()
    fireEvent.click(screen.getByRole('button', { name: /change password/i }))

    fireEvent.change(getPasswordInput(/^new password$/i), { target: { value: 'NewPass1!' } })
    fireEvent.change(getPasswordInput(/confirm new password/i), { target: { value: 'DifferentPass!' } })

    fireEvent.click(screen.getByRole('button', { name: /update password/i }))

    expect(screen.getByText('Passwords do not match')).toBeTruthy()
    expect(passwordFired).toBe(false)
  })
})
