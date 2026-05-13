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

MIGRATIONS = [
    ("Repaired",  "Repaired Received"),
    ("Ready",     "Ready for Delivery"),
    ("Shipped",   "Out for Delivery"),
    ("Cancelled", "Not Received"),
]

NEW_VALUES = [
    "Not Received", "Received", "Sent for Repair", "In Repair",
    "Repaired Not Received", "Repaired Received", "To Pack",
    "Ready for Delivery", "Out for Delivery", "Delivered",
]

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
