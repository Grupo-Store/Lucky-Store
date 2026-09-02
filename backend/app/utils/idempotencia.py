"""Leitura do header Idempotency-Key, compartilhada pelas rotas que numeram.

A chave identifica a TENTATIVA de salvar, nao o registro: a tela gera uma por
clique em "salvar" e reusa a mesma se precisar tentar de novo. Vendo uma chave
que ja criou registro, o backend devolve aquele em vez de criar outro — e o que
impede duplicata e numero queimado quando a gravacao da certo mas a RESPOSTA se
perde.
"""
from typing import Optional

from fastapi import HTTPException, status

MAX_IDEMPOTENCY_KEY = 64


def normalizar_chave(bruta: Optional[str]) -> Optional[str]:
    """Header opcional; ausente, o comportamento e o de antes."""
    if bruta is None:
        return None
    chave = bruta.strip()
    if not chave:
        # String vazia casaria com qualquer outra vazia e devolveria registro
        # alheio ao proprio usuario.
        return None
    if len(chave) > MAX_IDEMPOTENCY_KEY:
        # Barra aqui em vez de deixar o banco truncar: chave cortada deixaria de
        # bater com a da tentativa anterior, e o efeito seria criar a duplicata
        # que ela existe para impedir.
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Idempotency-Key deve ter no maximo {MAX_IDEMPOTENCY_KEY} caracteres",
        )
    return chave
