import unittest
from datetime import date, datetime
from business_reports import analyze, number


class BusinessReportTests(unittest.TestCase):
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
