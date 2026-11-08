import unittest
from unittest.mock import AsyncMock, MagicMock, patch
from types import SimpleNamespace
from datetime import date, datetime
from business_reports import analyze, number, live_receipt, live_summary, product_reports, product_performance
from fastapi import HTTPException


class LiveDateRangeTests(unittest.IsolatedAsyncioTestCase):
    async def test_branch_report_uses_names_and_each_branch_data(self):
        branches = [SimpleNamespace(store_id=1, name="Branch One"), SimpleNamespace(store_id=2, name="Branch Two")]
        backend = SimpleNamespace(list_erp_branches=AsyncMock(return_value=branches))
        summaries = [{"summary": {"sales": 10, "receipts": 1}}, {"summary": {"sales": 50, "receipts": 2}}]
        with patch.dict("sys.modules", {"main": backend}), patch("business_reports.business_report", new=AsyncMock(side_effect=summaries)) as report:
            result = await product_performance(date(2026, 11, 1), date(2026, 11, 6), 1, "branches")
        self.assertEqual([r["name"] for r in result["product_reports"]["branches"]], ["Branch Two", "Branch One"])
        self.assertEqual(report.await_args_list[1].args[2], 2)

    async def test_default_range_is_today_in_nairobi(self):
        from business_reports import EAT
        collection = MagicMock()
        collection.aggregate.return_value.to_list = AsyncMock(return_value=[])
        collection.find.return_value.sort.return_value.skip.return_value.limit.return_value.to_list = AsyncMock(return_value=[])
        with patch("business_reports.get_store_collection", return_value=collection):
            result = await live_summary(store_id=1, page=1, page_size=50, search="")
        self.assertEqual(result["date_from"], datetime.now(EAT).date().isoformat())
        self.assertEqual(result["date_to"], result["date_from"])
        self.assertIn("sdateTime", collection.find.call_args.args[0])

    async def test_range_includes_entire_local_end_date_and_filters_totals(self):
        collection = MagicMock()
        collection.aggregate.return_value.to_list = AsyncMock(return_value=[])
        collection.find.return_value.sort.return_value.skip.return_value.limit.return_value.to_list = AsyncMock(return_value=[])
        with patch("business_reports.get_store_collection", return_value=collection):
            result = await live_summary(store_id=1, page=1, page_size=50, search="",
                                        date_from=date(2026, 11, 5), date_to=date(2026, 11, 6))
        match = collection.aggregate.call_args.args[0][0]["$match"]
        self.assertEqual(match["sdateTime"], {"$gte": datetime(2026, 11, 4, 21), "$lt": datetime(2026, 11, 6, 21)})
        self.assertEqual(collection.find.call_args.args[0], match)
        self.assertEqual(result["summary"], {"sales": 0, "tax": 0})

    async def test_reversed_range_is_rejected(self):
        with self.assertRaises(HTTPException) as error:
            await live_summary(store_id=1, page=1, page_size=50, search="",
                               date_from=date(2026, 11, 6), date_to=date(2026, 11, 5))
        self.assertEqual(error.exception.status_code, 400)


class BusinessReportTests(unittest.TestCase):
    def test_product_reports_stock_returns_costs_months_and_forecast(self):
        receipts = [
            {"TransactionID": 1, "StoreID": 1, "sdateTime": datetime(2026, 10, 31, 22), "Total": 20},
            {"TransactionID": 2, "StoreID": 1, "sdateTime": datetime(2026, 10, 30, 12), "Total": -10},
        ]
        lines = [
            {"TransactionID": 1, "StoreID": 1, "ItemLookupCode": "A", "Quantity": 2, "Price": 10, "Cost": 6},
            {"TransactionID": 2, "StoreID": 1, "ItemLookupCode": "A", "Quantity": -1, "Price": 10, "Cost": 6},
            {"TransactionID": 1, "StoreID": 1, "ItemLookupCode": "B", "Quantity": 1, "Price": 5, "Cost": 0},
            {"TransactionID": 1, "StoreID": 2, "ItemLookupCode": "A", "Quantity": 900, "Price": 10},
        ]
        items = [{"ItemLookupCode": "A", "quantity": 10}, {"ItemLookupCode": "B", "Quantity": 4},
                 {"ItemLookupCode": "C", "StockAvailable": 5}]
        reports = product_reports(receipts, lines, items, date(2026, 10, 30), date(2026, 11, 1))["product_reports"]
        products = {r["name"]: r for r in reports["profitability"]}
        self.assertEqual(products["A"]["units"], 1)
        self.assertEqual(products["A"]["profit"], 4)
        self.assertIsNone(products["B"]["profit"])
        self.assertEqual([r["name"] for r in reports["dead"]], ["C"])
        self.assertEqual(reports["bottom"][0]["name"], "C")
        self.assertEqual(products["A"]["forecast_units"], 10)
        self.assertEqual(products["A"]["days_cover"], 30)
        self.assertIsNone(products["A"]["turnover"])
        self.assertEqual([r["month"] for r in reports["monthly"] if r["name"] == "A"], ["2026-10", "2026-11"])

    def test_product_rankings_limit_to_100_and_empty_reports(self):
        items = [{"ItemLookupCode": str(i)} for i in range(120)]
        reports = product_reports([], [], items, date(2026, 11, 1), date(2026, 11, 1))["product_reports"]
        self.assertEqual(len(reports["top"]), 100)
        self.assertEqual(len(reports["bottom"]), 100)
        self.assertEqual(reports["monthly"], [])
        self.assertEqual(reports["dead"], [])

    def test_live_tender_mix_uses_codes_for_split_payments(self):
        row = live_receipt({"Tenders": [
            {"code": "cash", "Description": "Cash payment", "amount": 100},
            {"Code": "MPESA", "Amount": 50},
            {"code": "cash", "amount": 20},
            {"code": "CARD", "amount": 30},
        ]})
        self.assertEqual(row["tender_mix"], "cash, MPESA, CARD")
        self.assertEqual(live_receipt({"Tenders": None})["tender_mix"], "—")

    def test_live_receipt_preserves_identifiers_and_local_time(self):
        row = live_receipt({"TransactionID": "00042", "BatchNumber": "007",
                            "sdateTime": datetime(2026, 11, 4, 22),
                            "SalesTax": 12.345, "Total": 100, "CashierID": 1002})
        self.assertEqual(row["receipt"], "00042")
        self.assertEqual(row["batch"], "007")
        self.assertEqual(row["time"], "2026-11-05T01:00:00+03:00")
        self.assertEqual(row["tax"], 12.35)
        self.assertEqual(row["cashier"], "1002")
        self.assertEqual(live_receipt({})["batch"], "—")

    def test_returns_missing_cost_and_timezone(self):
        receipts = [{"TransactionID": 7, "StoreID": 1, "sdateTime": datetime(2026, 11, 4, 22),
                     "Total": 180, "SalesTax": 20, "CashierID": 2,
                     "Tenders": [{"code": "CASH", "amount": 200}]}]
        lines = [{"TransactionID": 7, "StoreID": 1, "ItemID": 4, "Quantity": 2,
                  "Price": 100, "Cost": 60, "FullPrice": 110},
                 {"TransactionID": 7, "StoreID": 1, "ItemID": 5, "Quantity": -1,
                  "Price": 20, "Cost": 0},
                 {"TransactionID": 7, "StoreID": 2, "Quantity": 50, "Price": 100}]
        result = analyze(receipts, lines, date(2026, 11, 5), date(2026, 11, 6))
        summary = result['summary']
        self.assertEqual(summary['sales'], 180)
        self.assertEqual(summary['item_sales'], 180)
        self.assertEqual(summary['units'], 1)
        self.assertEqual(summary['returned_item_value'], 20)
        self.assertEqual(summary['recorded_cost'], 120)
        self.assertEqual(summary['missing_cost_lines'], 1)
        self.assertEqual(summary['recorded_discounts'], 20)
        self.assertEqual(result['daily'][0]['sales'], 180)
        self.assertEqual(result['daily'][1]['sales'], 0)
        self.assertEqual(result['hourly'][1]['sales'], 180)
        self.assertEqual(result['tenders'][0]['sales'], 200)

    def test_empty_and_invalid_numbers(self):
        result = analyze([], [], date(2026, 11, 5), date(2026, 11, 5))
        self.assertEqual(result['summary']['average_basket'], 0)
        self.assertEqual(len(result['hourly']), 24)
        self.assertEqual(number('NaN'), 0)
        self.assertEqual(number('bad'), 0)


if __name__ == '__main__':
    unittest.main()
