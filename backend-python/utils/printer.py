# utils/printer.py
import sys
import platform
import socket
import subprocess
import tempfile
import os
from escpos.printer import Serial, Usb, Network, Dummy, File

class POSPrinter:
    def __init__(self, printer_name=None):
        self.printer_name = printer_name or "POS-80C (copy 1)"
        self.printer = None

    def print_text(self, text):
        """Print text to the connected printer"""
        if self.printer:
            try:
                # Handle encoding issues
                if isinstance(text, str):
                    text = text.encode('utf-8', errors='ignore').decode('utf-8')
                self.printer.text(text)
                return True
            except Exception as e:
                print(f"Error printing text: {e}")
                return False
        else:
            print("No printer connected")
            return False

    def connect_usb(self, vendor_id, product_id, interface=0, in_ep=0x82, out_ep=0x01):
        """
        Connect to a USB printer (Vendor ID & Product ID from lsusb or Device Manager)
        """
        try:
            self.printer = Usb(vendor_id, product_id, interface, in_ep, out_ep)
            print(f"Connected to USB printer {vendor_id}:{product_id}")
            return True
        except Exception as e:
            print(f"Failed to connect USB printer: {e}")
            return False

    def connect_network(self, host, port=9100):
        """
        Connect to a network printer (Ethernet/WiFi) using IP & Port
        """
        try:
            # First check if host is reachable
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)
            result = sock.connect_ex((host, port))
            sock.close()
            
            if result != 0:
                print(f"Network printer at {host}:{port} is not reachable")
                return False
            
            self.printer = Network(host, port=port, timeout=30)
            print(f"Connected to network printer at {host}:{port}")
            return True
        except Exception as e:
            print(f"Failed to connect network printer: {e}")
            return False

    def connect_file(self, device_path):
        """
        Connect to a printer via file/device path (e.g., /dev/usb/lp0 on Linux)
        """
        try:
            self.printer = File(device_path)
            print(f"Connected to printer at {device_path}")
            return True
        except Exception as e:
            print(f"Failed to connect to printer at {device_path}: {e}")
            return False

    def connect_windows(self, printer_name=None):
        """
        Connect to a Windows printer using win32print
        """
        try:
            import win32print
            target_printer = printer_name or self.printer_name or "POS-80C (copy 1)"
            # Check if printer exists
            printer_handle = win32print.OpenPrinter(target_printer)
            win32print.ClosePrinter(printer_handle)
            self.printer_name = target_printer
            print(f"Connected to Windows printer: {target_printer}")
            return True
        except ImportError:
            print("win32print module not available")
            return False
        except Exception as e:
            print(f"Failed to connect to Windows printer {target_printer}: {e}")
            return False

    def print_windows_receipt(self, store_name, items, total, tax=0, footer_msg="Thank you! confirm change and items ", printer_name=None):
        """
        Print receipt using Windows printer API with full width formatting
        """
        try:
            import win32print
            
            target_printer = printer_name or self.printer_name or "POS-80C (copy 1)"
            hprinter = win32print.OpenPrinter(target_printer)
            
            try:
                hjob = win32print.StartDocPrinter(hprinter, 1, ("Receipt", None, "RAW"))
                try:
                    win32print.StartPagePrinter(hprinter)
                    
                    # Send ESC/POS initialization commands for full width
                    win32print.WritePrinter(hprinter, b'\x1B\x40')  # ESC @ (Initialize)
                    win32print.WritePrinter(hprinter, b'\x1B\x61\x00')  # ESC a 0 (Left align)
                    win32print.WritePrinter(hprinter, b'\x1B\x20\x00')  # ESC SP 0 (Set character spacing)
                    win32print.WritePrinter(hprinter, b'\x1D\x4C\x00\x00')  # GS L 0 0 (Left margin 0)
                    win32print.WritePrinter(hprinter, b'\x1D\x57\x40\x02')  # GS W 64 2 (576-dot width for 80mm)
                    win32print.WritePrinter(hprinter, b'\x1B\x4D\x00')  # ESC M 0 (Font A)
                    win32print.WritePrinter(hprinter, b'\x1B\x32')  # ESC 2 (Default line spacing)
                    
                    # Format receipt as plain text with full width
                    receipt_lines = []
                    receipt_lines.append(store_name.center(48))
                    receipt_lines.append("=" * 48)
                    receipt_lines.append(f"{'Item':30}{'Qty':>6}{'Price':>12}")
                    receipt_lines.append("-" * 48)
                    
                    for item in items:
                        name = item.get('name', '')[:30].ljust(30)
                        qty = str(item.get('qty', 1)).rjust(6)
                        price = f"{item.get('price', 0):.2f}".rjust(12)
                        receipt_lines.append(f"{name}{qty}{price}")
                    
                    receipt_lines.append("-" * 48)
                    receipt_lines.append(f"{'Tax':>36}{tax:>12.2f}")
                    receipt_lines.append(f"{'TOTAL':>36}{total:>12.2f}")
                    receipt_lines.append("=" * 48)
                    receipt_lines.append(footer_msg.center(48))
                    receipt_lines.append("")
                    receipt_lines.append("")
                    
                    # Send each line to printer
                    for line in receipt_lines:
                        win32print.WritePrinter(hprinter, (line + "\n").encode('utf-8'))
                    
                    # Cut paper
                    win32print.WritePrinter(hprinter, b'\x1D\x56\x00')
                    
                    win32print.EndPagePrinter(hprinter)
                finally:
                    win32print.EndDocPrinter(hprinter)
            finally:
                win32print.ClosePrinter(hprinter)
                
            print("Receipt printed successfully via Windows printer")
            return True
        except ImportError:
            print("win32print module not available for Windows printing")
            return False
        except Exception as e:
            print(f"Failed to print via Windows printer: {e}")
            return False

    def print_receipt(self, store_name, items, total, tax=0, footer_msg="Thank youuuu!"):
        """
        Print receipt with store info, dynamic item list, totals, and footer
        Optimized for 80mm printer (48 characters per line)
        """
        if not self.printer:
            print("No printer connected!")
            return False

        try:
            # Store name: big and centered
            self.printer.set(bold=True, double_height=True, double_width=True, align='center')
            self.printer.text(f"{store_name}\n")

            # Separator (full width for 80mm)
            self.printer.set(align='center')
            self.printer.text("=" * 48 + "\n")

            # Header row
            self.printer.set(align='left')
            self.printer.text(f"{'Item':30}{'Qty':>6}{'Price':>12}\n")

            # Item lines
            for item in items:
                name = item.get('name', '')[:30].ljust(30)   # 30 chars
                qty = str(item.get('qty', 1)).rjust(6)       # 6 chars
                price = f"{item.get('price', 0):.2f}".rjust(12)  # 12 chars
                self.printer.text(f"{name}{qty}{price}\n")

            # Separator
            self.printer.set(align='center')
            self.printer.text("=" * 48 + "\n")

            # Totals (right aligned)
            self.printer.set(align='right')
            self.printer.text(f"{'Tax:':>36}{tax:>12.2f}\n")
            self.printer.text(f"{'TOTAL:':>36}{total:>12.2f}\n")

            # Footer
            self.printer.set(align='center')
            self.printer.text("=" * 48 + "\n")
            self.printer.text(f"{footer_msg}\n\n\n")

            # Cut
            self.printer.cut()

            print("Receipt printed successfully")
            return True
        except Exception as e:
            print(f"Printing failed: {e}")
            return False

    def print_full_width_receipt(self, store_name, items, total, tax=0, transaction_id=None, register_id=None, cashier_id=None, tenders=None, loyalty_info=None, footer_msg="Thank you!", printer_name=None):
        """
        Print receipt using full width formatting with ESC/POS commands
        Includes register number, tender information, and loyalty information
        """
        try:
            import win32print
            
            target_printer = printer_name or self.printer_name or "POS-80C (copy 1)"
            hprinter = win32print.OpenPrinter(target_printer)
            
            try:
                hjob = win32print.StartDocPrinter(hprinter, 1, ("Receipt", None, "RAW"))
                try:
                    win32print.StartPagePrinter(hprinter)
                    
                    # Send ESC/POS initialization commands for full width
                    win32print.WritePrinter(hprinter, b'\x1B\x40')  # ESC @ (Initialize printer)
                    win32print.WritePrinter(hprinter, b'\x1B\x61\x00')  # ESC a 0 (Left align)
                    win32print.WritePrinter(hprinter, b'\x1B\x20\x00')  # ESC SP 0 (Set character spacing to normal)
                    win32print.WritePrinter(hprinter, b'\x1D\x4C\x00\x00')  # GS L 0 0 (Left margin 0)
                    win32print.WritePrinter(hprinter, b'\x1D\x57\x40\x02')  # GS W 64 2 (576-dot width for 80mm)
                    win32print.WritePrinter(hprinter, b'\x1D\x21\x00')  # GS ! 0 (Set font to normal size)
                    win32print.WritePrinter(hprinter, b'\x1B\x4D\x00')  # ESC M 0 (Font A)
                    win32print.WritePrinter(hprinter, b'\x1B\x32')  # ESC 2 (Default line spacing)
                    
                    # Print store name centered
                    centered_name = store_name.center(48)
                    win32print.WritePrinter(hprinter, (centered_name + "\n").encode('utf-8'))
                    
                    # Print separator
                    win32print.WritePrinter(hprinter, ("=" * 48 + "\n").encode('utf-8'))
                    
                    # Print transaction details
                    if transaction_id:
                        win32print.WritePrinter(hprinter, f"Transaction: {transaction_id}\n".encode('utf-8'))
                    if register_id:
                        win32print.WritePrinter(hprinter, f"Register: {register_id}\n".encode('utf-8'))
                    if cashier_id:
                        win32print.WritePrinter(hprinter, f"Cashier: {cashier_id}\n".encode('utf-8'))
                    
                    # Print header
                    win32print.WritePrinter(hprinter, ("-" * 48 + "\n").encode('utf-8'))
                    header = f"{'Item':30}{'Qty':>6}{'Price':>12}"
                    win32print.WritePrinter(hprinter, (header + "\n").encode('utf-8'))
                    win32print.WritePrinter(hprinter, ("-" * 48 + "\n").encode('utf-8'))
                    
                    # Print items
                    for item in items:
                        name = item.get('name', '')[:30].ljust(30)
                        qty = str(item.get('qty', 1)).rjust(6)
                        price = f"{item.get('price', 0):.2f}".rjust(12)
                        line = f"{name}{qty}{price}"
                        win32print.WritePrinter(hprinter, (line + "\n").encode('utf-8'))
                    
                    # Print totals
                    win32print.WritePrinter(hprinter, ("-" * 48 + "\n").encode('utf-8'))
                    tax_line = f"{'Tax':>36}{tax:>12.2f}"
                    win32print.WritePrinter(hprinter, (tax_line + "\n").encode('utf-8'))
                    total_line = f"{'TOTAL':>36}{total:>12.2f}"
                    win32print.WritePrinter(hprinter, (total_line + "\n").encode('utf-8'))
                    
                    # Print tender information
                    if tenders:
                        win32print.WritePrinter(hprinter, ("-" * 48 + "\n").encode('utf-8'))
                        win32print.WritePrinter(hprinter, "Payment Method:\n".encode('utf-8'))
                        total_tendered = 0
                        for t in tenders:
                            code = t.get("code") or t.get("Code") or t.get("Description") or ""
                            amount = float(t.get("amount", t.get("Amount", 0.0)))
                            total_tendered += amount
                            tender_line = f"  {code:32}{amount:>12.2f}"
                            win32print.WritePrinter(hprinter, (tender_line + "\n").encode('utf-8'))
                        
                        change = total_tendered - total
                        win32print.WritePrinter(hprinter, f"{'Tendered':>36}{total_tendered:>12.2f}\n".encode('utf-8'))
                        win32print.WritePrinter(hprinter, f"{'Change':>36}{change:>12.2f}\n".encode('utf-8'))
                    
                    # Print loyalty information
                    win32print.WritePrinter(hprinter, ("-" * 48 + "\n").encode('utf-8'))
                    if loyalty_info:
                        win32print.WritePrinter(hprinter, f"Loyalty Points Earned: {loyalty_info.get('points_earned', 0)}\n".encode('utf-8'))
                        win32print.WritePrinter(hprinter, f"Loyalty Points Balance: {loyalty_info.get('points_balance', 0)}\n".encode('utf-8'))
                        if loyalty_info.get('customer_name'):
                            win32print.WritePrinter(hprinter, f"Customer: {loyalty_info.get('customer_name')}\n".encode('utf-8'))
                    else:
                        win32print.WritePrinter(hprinter, "Loyalty Points Earned: 0\n".encode('utf-8'))
                        win32print.WritePrinter(hprinter, "Loyalty Points Balance: 0\n".encode('utf-8'))
                    
                    # Print footer separator
                    win32print.WritePrinter(hprinter, ("=" * 48 + "\n").encode('utf-8'))
                    
                    # Print footer message centered
                    centered_footer = footer_msg.center(48)
                    win32print.WritePrinter(hprinter, (centered_footer + "\n").encode('utf-8'))
                    
                    # Print blank lines
                    win32print.WritePrinter(hprinter, "\n\n".encode('utf-8'))
                    
                    # Cut paper
                    win32print.WritePrinter(hprinter, b'\x1D\x56\x00')
                    
                    win32print.EndPagePrinter(hprinter)
                finally:
                    win32print.EndDocPrinter(hprinter)
            finally:
                win32print.ClosePrinter(hprinter)
                
            print("Full width receipt printed successfully!")
            return True
            
        except Exception as e:
            print(f"Failed to print full width receipt: {e}")
            return False

    def test_print(self):
        """
        Prints a test page
        """
        if not self.printer:
            print("No printer connected!")
            return False
        try:
            self.printer.set(align='center')
            self.printer.text("*** TEST PRINT ***\n")
            self.printer.text(f"System: {platform.system()} {platform.release()}\n")
            self.printer.text("Printer ready.\n\n\n")
            self.printer.cut()
            print("Test page printed")
            return True
        except Exception as e:
            print(f"Test print failed: {e}")
            return False
