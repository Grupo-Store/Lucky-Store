from decimal import Decimal


def paid_amount(frete):
    value = getattr(frete, 'valor_pago', None)
    return Decimal(str(value if value is not None else frete.valor if frete.pago else 0))


def payment_fields(frete, values):
    """Preserve partial payments when the OS only edits freight metadata."""
    total = Decimal(str(values.get('valor', frete.valor)))
    if total < 0:
        raise ValueError('O valor do frete não pode ser negativo.')
    paid = paid_amount(frete)
    changed_status = 'pago' in values and values['pago'] != frete.pago
    if changed_status:
        paid = total if values['pago'] else Decimal('0')
    if paid > total:
        raise ValueError('Desfaça o pagamento excedente antes de reduzir o valor do frete.')
    return dict(valor_pago=paid, pago=(paid >= total if total > 0 else values.get('pago', frete.pago)))
