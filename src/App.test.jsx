import { render, screen } from '@testing-library/react'
import React from 'react'
import App from './App'

const STORAGE_KEY = 'dapai-score-state-v1'

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders title, default players and primary actions', () => {
    render(<App />)

    expect(screen.getByText('打牌积分表单')).toBeInTheDocument()
    expect(screen.getByLabelText('玩家名称 1')).toHaveValue('玩家 A')
    expect(screen.getByLabelText('玩家名称 2')).toHaveValue('玩家 B')
    expect(screen.getAllByRole('button', { name: /新增一局/ })).toHaveLength(2)
    expect(screen.getByRole('button', { name: '导出 CSV' })).toBeInTheDocument()
  })

  it('persists and reloads rounds from localStorage', () => {
    const state = {
      players: ['玩家 A', '玩家 B', '玩家 C', '玩家 D'],
      rounds: [
        { id: 1, scores: [10, -5, -3, -2], note: '' },
        { id: 2, scores: [-4, 4, 0, 0], note: '' },
      ],
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

    render(<App />)

    expect(screen.getByRole('row', { name: /第 1 局/ })).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /第 2 局/ })).toBeInTheDocument()
    expect(screen.getByLabelText('玩家 A 总分 6')).toBeInTheDocument()
  })
})
