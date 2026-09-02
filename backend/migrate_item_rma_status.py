"""
One-time migration: update item_rma.status from old 8-value enum to new 10-value enum.

Old -> New mapping:
  Repaired   -> Repaired Received
  Ready      -> Ready for Delivery
  Shipped    -> Out for Delivery
  Cancelled  -> Not Received
  (Not Received, Received, In Repair, Delivered stay the same)
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import text
from app.database import engine
from app.models.item_rma import ItemRmaStatus

MIGRATIONS = [
    ("Repaired",  "Repaired Received"),
    ("Ready",     "Ready for Delivery"),
    ("Shipped",   "Out for Delivery"),
    ("Cancelled", "Not Received"),
]

# Derivado do enum, nao copiado dele.
#
# Esta lista era escrita a mao e ficou para tras: o status "Estorno" entrou no
# ItemRmaStatus (e no banco, pela migration f1a2b3c4d5e6) e ninguem lembrou
# daqui. Como o script DERRUBA e RECRIA o item_rma_status_check, roda-lo depois
# disso recriaria a trava sem o "Estorno" — e todo item de RMA estornado passaria
# a ser rejeitado pelo banco. Ele nao roda sozinho, entao era bomba com pino;
# ainda assim, o pino estava solto desde entao.
#
# Lendo do enum, a lista nao tem como divergir de novo: o proximo status entra
# aqui no mesmo instante em que entra no codigo.
NEW_VALUES = [status.value for status in ItemRmaStatus]

def run():
    with engine.connect() as conn:
        # Drop old check constraint so we can insert the new values
        conn.execute(text(
            "ALTER TABLE item_rma DROP CONSTRAINT IF EXISTS item_rma_status_check"
        ))
        print("  Dropped old check constraint.")

        for old, new in MIGRATIONS:
            result = conn.execute(
                text("UPDATE item_rma SET status = :new WHERE status = :old"),
                {"old": old, "new": new},
            )
            if result.rowcount:
                print(f"  {old!r} -> {new!r}: {result.rowcount} row(s) updated")
            else:
                print(f"  {old!r}: no rows found, skipping")

        # Add new check constraint with updated values
        values_sql = ", ".join(f"'{v}'" for v in NEW_VALUES)
        conn.execute(text(
            f"ALTER TABLE item_rma ADD CONSTRAINT item_rma_status_check "
            f"CHECK (status IN ({values_sql}))"
        ))
        print("  Added new check constraint.")

        conn.commit()
    print("Migration complete.")

if __name__ == "__main__":
    run()
