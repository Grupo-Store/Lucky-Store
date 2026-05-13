"""
Unit tests for the one-time ItemRmaStatus migration script.

Validates:
  - MIGRATIONS list contains exactly the 4 expected value mappings
  - NEW_VALUES list has exactly 10 entries (matches ItemRmaStatus enum)
  - Every value in NEW_VALUES is a valid ItemRmaStatus
  - No duplicates in NEW_VALUES
  - Values that should NOT appear in NEW_VALUES (removed old strings)
"""
import pytest
from app.models.item_rma import ItemRmaStatus
from migrate_item_rma_status import MIGRATIONS, NEW_VALUES


class TestMigrationMappings:

    def test_migrations_has_four_entries(self):
        assert len(MIGRATIONS) == 4

    def test_repaired_maps_to_repaired_received(self):
        mapping = dict(MIGRATIONS)
        assert mapping["Repaired"] == "Repaired Received"

    def test_ready_maps_to_ready_for_delivery(self):
        mapping = dict(MIGRATIONS)
        assert mapping["Ready"] == "Ready for Delivery"

    def test_shipped_maps_to_out_for_delivery(self):
        mapping = dict(MIGRATIONS)
        assert mapping["Shipped"] == "Out for Delivery"

    def test_cancelled_maps_to_not_received(self):
        mapping = dict(MIGRATIONS)
        assert mapping["Cancelled"] == "Not Received"

    def test_all_destination_values_are_valid_enum_members(self):
        valid_values = {e.value for e in ItemRmaStatus}
        for _old, new in MIGRATIONS:
            assert new in valid_values, f"'{new}' is not a valid ItemRmaStatus"

    def test_source_values_are_not_valid_enum_members(self):
        valid_values = {e.value for e in ItemRmaStatus}
        for old, _new in MIGRATIONS:
            assert old not in valid_values, (
                f"'{old}' should no longer be a valid ItemRmaStatus value"
            )


class TestNewValues:

    def test_new_values_has_ten_entries(self):
        assert len(NEW_VALUES) == 10

    def test_new_values_matches_enum_count(self):
        assert len(NEW_VALUES) == len(ItemRmaStatus)

    def test_no_duplicates_in_new_values(self):
        assert len(NEW_VALUES) == len(set(NEW_VALUES))

    def test_all_new_values_are_valid_enum_members(self):
        valid_values = {e.value for e in ItemRmaStatus}
        for v in NEW_VALUES:
            assert v in valid_values, f"'{v}' is not a valid ItemRmaStatus"

    def test_new_values_covers_all_enum_members(self):
        enum_values = {e.value for e in ItemRmaStatus}
        assert set(NEW_VALUES) == enum_values

    def test_not_received_in_new_values(self):
        assert "Not Received" in NEW_VALUES

    def test_repaired_received_in_new_values(self):
        assert "Repaired Received" in NEW_VALUES

    def test_ready_for_delivery_in_new_values(self):
        assert "Ready for Delivery" in NEW_VALUES

    def test_out_for_delivery_in_new_values(self):
        assert "Out for Delivery" in NEW_VALUES

    def test_old_repaired_not_in_new_values(self):
        assert "Repaired" not in NEW_VALUES

    def test_old_ready_not_in_new_values(self):
        assert "Ready" not in NEW_VALUES

    def test_old_shipped_not_in_new_values(self):
        assert "Shipped" not in NEW_VALUES

    def test_old_cancelled_not_in_new_values(self):
        assert "Cancelled" not in NEW_VALUES
