import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { AuditLogTable } from '@/components/AuditLogTable'

export default function Admin() {
  // Estado local: o ID do pedido digitado pelo admin
  // useState('') = começa com string vazia
  const [input, setInput] = useState('')
  // pedidoId confirmado — só muda ao clicar em Buscar
  const [pedidoId, setPedidoId] = useState('')

  function handleBuscar() {
    setPedidoId(input.trim())
  }

  // Permite buscar pressionando Enter no input
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleBuscar()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-secondary">Painel Administrativo</h1>

      <Card>
        <CardHeader>
          <CardTitle>Auditoria de Pedidos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-1">
              <Label htmlFor="pedido-id">ID do Pedido</Label>
              <Input
                id="pedido-id"
                placeholder="Cole o UUID do pedido aqui"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <Button onClick={handleBuscar} disabled={!input.trim()}>
              Buscar
            </Button>
          </div>

          {/* Renderização condicional: só exibe a tabela depois de confirmar o ID */}
          {pedidoId && <AuditLogTable pedidoId={pedidoId} />}
        </CardContent>
      </Card>
    </div>
  )
}
