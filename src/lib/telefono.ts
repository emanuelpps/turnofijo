/**
 * Normaliza teléfonos argentinos a E.164 (`+549XXXXXXXXXX`).
 *
 * Un número nacional sin el `0` de larga distancia y sin el `15` de celular
 * tiene siempre 10 dígitos: código de área (2, 3 o 4) + abonado. Para WhatsApp
 * siempre se usa el móvil, así que el prefijo es `+549`.
 *
 * Devuelve `null` si no se puede interpretar como número argentino. El llamador
 * decide qué hacer: acá no se adivina.
 */
export function normalizarTelefonoAR(entrada: string): string | null {
  const bruto = entrada.trim()
  if (!bruto) return null

  const tieneMas = bruto.startsWith('+')
  let digitos = bruto.replace(/\D/g, '')
  if (!digitos) return null

  if (tieneMas && !digitos.startsWith('54')) {
    // Internacional explícito de otro país: no es asunto nuestro.
    return null
  }

  if (digitos.startsWith('54')) digitos = digitos.slice(2)
  if (digitos.startsWith('9')) digitos = digitos.slice(1)
  if (digitos.startsWith('0')) digitos = digitos.slice(1)

  // El `15` va pegado después del código de área (2, 3 o 4 dígitos).
  if (digitos.length === 12) {
    for (const i of [2, 3, 4]) {
      if (digitos.slice(i, i + 2) === '15') {
        digitos = digitos.slice(0, i) + digitos.slice(i + 2)
        break
      }
    }
  }

  if (digitos.length !== 10) return null

  return `+549${digitos}`
}

/** `+5492984123456` → `+54 9 2984 12-3456`. Solo para mostrar. */
export function formatearTelefonoParaMostrar(e164: string): string {
  const m = e164.match(/^\+549(\d{2,4})(\d{2})(\d{4})$/)
  if (!m) return e164
  return `+54 9 ${m[1]} ${m[2]}-${m[3]}`
}
