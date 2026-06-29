'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { ProductsService } from '@/lib/api-client/products';
import { SalesClient, CreateSalePayload } from '@/lib/api-client/sales';
import { syncQueue } from '@/lib/offline/sync-queue';
import { attemptSync, startBackgroundSync } from '@/lib/offline/sync-worker';
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { formatPaise } from '@/lib/utils/formatters';
import QRCode from 'react-qr-code';

interface CartItem {
  id: string; // product id
  name: string;
  quantity: number;
  unitSellingPricePaise: number;
  batchId?: string;
}

export default function PosPage() {
  const { activeStore } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  
  // Scanner state
  const [pin, setPin] = useState('');
  const [scannerConnected, setScannerConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Sync state
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (!activeStore) return;
    
    // Load products
    ProductsService.findAll().then((res: any) => {
      if (res.success) setProducts(res.data);
    });

    // Offline tracker
    setIsOnline(navigator.onLine);
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    
    // Start background sync
    startBackgroundSync(activeStore.id);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [activeStore]);

  const initScanner = () => {
    if (socket) return;
    const newPin = Math.floor(100000 + Math.random() * 900000).toString();
    setPin(newPin);

    // Connect to WebSocket Gateway (assuming backend runs on 4000)
    // Need NEXT_PUBLIC_API_URL or relative if proxied
    const wsUrl = process.env.NEXT_PUBLIC_API_URL?.replace('http', 'ws')?.replace('/api/v1', '') || 'ws://localhost:4000';
    
    const newSocket = io(`${wsUrl}/scanner`);
    
    newSocket.on('connect', () => {
      newSocket.emit('join_room', { pin: newPin });
    });

    newSocket.on('device_connected', () => {
      setScannerConnected(true);
    });

    newSocket.on('device_disconnected', () => {
      setScannerConnected(false);
    });

    newSocket.on('on_barcode_scanned', (data: { barcode: string }) => {
      handleBarcodeScan(data.barcode);
    });

    setSocket(newSocket);
  };

  const handleBarcodeScan = (barcode: string) => {
    // Find product locally
    const product = products.find(p => p.barcode === barcode);
    if (product) {
      addToCart(product);
    } else {
      alert(`Product with barcode ${barcode} not found!`);
    }
  };

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      // For MVP, if there's no batch picking UI, just grab first batch id if any, or null
      // Real POS would either auto-deduct FIFO backend or let cashier select. We pass null and let backend handle or we assume no batch for simple products.
      return [...prev, {
        id: product.id,
        name: product.name,
        quantity: 1,
        unitSellingPricePaise: product.sellingPricePaise,
      }];
    });
  };

  const completeSale = async (method: 'CASH' | 'UPI' | 'CARD') => {
    if (!activeStore || cart.length === 0) return;

    const totalPaise = cart.reduce((sum, item) => sum + (item.unitSellingPricePaise * item.quantity), 0);
    // Add tax if needed for total, for now assuming sellingPrice is tax inclusive or tax is calculated by backend based on subtotal.
    // In our backend, totalPaise = (unitSellingPrice * qty) + tax, but frontend sends amountPaise for payment.
    // The cashier collects the full amount.

    const clientSaleId = uuidv4();
    const idempotencyKey = uuidv4();

    const payload: CreateSalePayload = {
      idempotencyKey,
      clientSaleId,
      saleSource: isOnline ? 'ONLINE' : 'OFFLINE_SYNC',
      items: cart.map(c => ({
        productId: c.id,
        quantity: c.quantity,
        unitSellingPricePaise: c.unitSellingPricePaise,
        discountPaise: 0,
      })),
      payments: [
        { method, amountPaise: totalPaise }
      ],
    };

    setCart([]); // Optimistically clear cart

    if (!isOnline) {
      await syncQueue.addPendingSale(activeStore.id, idempotencyKey, payload);
      alert('You are offline. Sale saved locally and will sync automatically!');
      return;
    }

    try {
      const res = await SalesClient.createSale(activeStore.id, payload);
      if (res.success) {
        alert('Sale completed! Invoice: ' + res.data.invoice?.invoiceNumber);
      }
    } catch (e: any) {
      console.error(e);
      // Fallback to offline queue if network error during request
      await syncQueue.addPendingSale(activeStore.id, idempotencyKey, payload);
      alert('Network error. Sale queued for sync.');
    }
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode?.includes(search));
  const subtotalPaise = cart.reduce((sum, item) => sum + (item.unitSellingPricePaise * item.quantity), 0);

  if (!activeStore) return null;

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* LEFT: CART */}
      <div className="w-1/2 border-r bg-white flex flex-col">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold">Current Sale</h2>
          <div className="flex items-center space-x-2">
            <span className={`h-3 w-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-500">{isOnline ? 'Online' : 'Offline Mode'}</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cart.length === 0 ? (
            <div className="text-center text-gray-400 mt-10">Cart is empty. Scan an item or click to add.</div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex justify-between items-center p-3 border rounded">
                <div>
                  <div className="font-semibold">{item.name}</div>
                  <div className="text-sm text-gray-500">{formatPaise(item.unitSellingPricePaise)} x {item.quantity}</div>
                </div>
                <div className="font-bold">
                  {formatPaise(item.unitSellingPricePaise * item.quantity)}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t bg-gray-50">
          <div className="flex justify-between text-2xl font-bold mb-4">
            <span>Total</span>
            <span>{formatPaise(subtotalPaise)}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => completeSale('CASH')} disabled={cart.length === 0} className="bg-green-600 text-white py-3 rounded font-bold hover:bg-green-700 disabled:opacity-50">
              CASH
            </button>
            <button onClick={() => completeSale('UPI')} disabled={cart.length === 0} className="bg-blue-600 text-white py-3 rounded font-bold hover:bg-blue-700 disabled:opacity-50">
              UPI
            </button>
            <button onClick={() => completeSale('CARD')} disabled={cart.length === 0} className="bg-purple-600 text-white py-3 rounded font-bold hover:bg-purple-700 disabled:opacity-50">
              CARD
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT: PRODUCTS & SCANNER */}
      <div className="w-1/2 flex flex-col bg-gray-50">
        <div className="p-4 border-b flex justify-between items-center bg-white">
          <input 
            type="text" 
            placeholder="Search products or scan barcode..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full max-w-md px-4 py-2 border rounded focus:ring focus:ring-indigo-200"
          />
          <button 
            onClick={initScanner}
            className={`ml-4 px-4 py-2 border rounded font-medium flex items-center ${scannerConnected ? 'bg-green-100 text-green-700 border-green-300' : 'bg-white hover:bg-gray-50'}`}
          >
            {scannerConnected ? 'Scanner Paired 📱' : (pin ? `PIN: ${pin}` : 'Pair Scanner')}
          </button>
        </div>

        {pin && !scannerConnected && (
          <div className="bg-white border-b p-4 flex flex-col items-center justify-center">
            <p className="text-sm text-gray-500 mb-2">Scan with your phone to pair</p>
            <QRCode value={`${window.location.origin}/scanner?pin=${pin}`} size={128} />
            <p className="text-xl font-bold mt-2 tracking-widest">{pin}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map(p => (
              <div 
                key={p.id} 
                onClick={() => addToCart(p)}
                className="bg-white border rounded p-4 cursor-pointer hover:border-indigo-500 hover:shadow-sm transition-all"
              >
                <div className="font-medium text-gray-900 truncate">{p.name}</div>
                <div className="text-gray-500 text-sm mt-1">{formatPaise(p.sellingPricePaise)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
