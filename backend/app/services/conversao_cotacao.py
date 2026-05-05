from uuid import UUID
from sqlalchemy.orm import Session

from app.models.pedido import Pedido
from app.utils.errors import BusinessLogicException


class ConversaoCotacaoService:
    """
    Serviço de conversão de Cotação em Pedido.

    ⚠️ PENDÊNCIA — Endpoint temporariamente bloqueado.

    Para destravar, é necessário decisão do gerente sobre:

    1. Mapeamento de cliente:
       - Cotacao.cnpj_cliente é uma string opcional
       - Pedido.id_cliente é FK obrigatória para clientes
       - Opções: (a) buscar/criar cliente automaticamente pelo CNPJ;
                 (b) tornar id_cliente opcional no Pedido.

    2. Numero OS / NF:
       - Pedido.numero_os e numero_nf são NOT NULL no model atual
       - Vendedor preenche apenas após o pedido ser criado
       - Opções: (a) tornar nullable=True;
                 (b) gerar valores temporários ("PENDING-{id}");
                 (c) exigir esses campos no payload da conversão.

    Quando essas decisões forem tomadas, substituir o método abaixo pela
    implementação real e remover o raise.
    """

    @staticmethod
    def convert_to_pedido(
        db: Session,
        cotacao_id: UUID,
        current_user_id: UUID,
    ) -> Pedido:
        raise BusinessLogicException(
            "Conversão de cotação em pedido ainda não está disponível. "
            "Pendências: (1) mapeamento de cliente (cnpj_cliente → id_cliente FK), "
            "(2) campos numero_os e numero_nf precisam ser opcionais no Pedido. "
            "Aguardando definição do gerente."
        )
