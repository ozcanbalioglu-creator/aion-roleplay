import { describe, it, expect } from 'vitest'
import { resolveRoleplayContract, DEFAULT_ROLE_CONTRACT } from './system-prompt.builder'

describe('resolveRoleplayContract (P1-Roleplay-001 fallback)', () => {
  it('NULL → DEFAULT_ROLE_CONTRACT döner', () => {
    expect(resolveRoleplayContract(null)).toBe(DEFAULT_ROLE_CONTRACT)
  })

  it('undefined → DEFAULT_ROLE_CONTRACT döner', () => {
    expect(resolveRoleplayContract(undefined)).toBe(DEFAULT_ROLE_CONTRACT)
  })

  it('boş string → DEFAULT_ROLE_CONTRACT döner', () => {
    expect(resolveRoleplayContract('')).toBe(DEFAULT_ROLE_CONTRACT)
  })

  it('whitespace-only → DEFAULT_ROLE_CONTRACT döner', () => {
    expect(resolveRoleplayContract('   \n\t  ')).toBe(DEFAULT_ROLE_CONTRACT)
  })

  it('custom kontrat → trim edilmiş metin döner (DB değeri öncelikli)', () => {
    const custom = '  Sen koçsun, kullanıcı çalışan.  '
    expect(resolveRoleplayContract(custom)).toBe('Sen koçsun, kullanıcı çalışan.')
  })

  it('DEFAULT_ROLE_CONTRACT zero-regression için kritik kuralları içerir', () => {
    expect(DEFAULT_ROLE_CONTRACT).toContain('## EN ÖNEMLİ KURAL — ROL DAĞILIMI')
    expect(DEFAULT_ROLE_CONTRACT).toContain('SEN soru SORMAZSIN')
    expect(DEFAULT_ROLE_CONTRACT).toContain('Yarım Cümle ve Belirsiz Girdiler')
  })
})
