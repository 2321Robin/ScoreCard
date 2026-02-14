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

    expect(screen.getByText('打牌记分器')).toBeInTheDocument()
    expect(screen.getByLabelText('玩家名称 1')).toHaveValue('玩家 A')
    expect(screen.getByLabelText('玩家名称 2')).toHaveValue('玩家 B')
    expect(screen.getByRole('button', { name: '添加本局' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '自动平衡' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '导出当前 CSV' })).toBeInTheDocument()
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

  it('renders cross-session overview when multiple sessions exist', () => {
    const sessions = [
      {
        id: 1,
        name: '会话 1',
        players: ['玩家 A', '玩家 B'],
        rounds: [{ id: 1, scores: [5, -5] }],
        nextRoundId: 2,
        targetRounds: '',
        createdAt: Date.now() - 1000,
      },
      {
        id: 2,
        name: '会话 2',
        players: ['玩家 A', '玩家 B'],
        rounds: [{ id: 1, scores: [-3, 3] }],
        nextRoundId: 2,
        targetRounds: '',
        createdAt: Date.now(),
      },
    ]
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessions, currentSessionId: 1 }))

    render(<App />)

    expect(screen.getByText('跨会话总览')).toBeInTheDocument()
    expect(screen.getAllByText('会话 2').length).toBeGreaterThanOrEqual(1)
  })
})
