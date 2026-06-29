'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';

function ScannerApp() {
  const searchParams = useSearchParams();
  const initialPin = searchParams.get('pin') || '';

  const [pin, setPin] = useState(initialPin);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [lastScan, setLastScan] = useState('');

  useEffect(() => {
    if (initialPin) {
      connectToDesktop(initialPin);
    }
  }, [initialPin]);

  const connectToDesktop = (targetPin: string) => {
    const wsUrl = process.env.NEXT_PUBLIC_API_URL?.replace('http', 'ws')?.replace('/api/v1', '') || 'ws://localhost:4000';
    const newSocket = io(`${wsUrl}/scanner`);

    newSocket.on('connect', () => {
      newSocket.emit('join_room', { pin: targetPin });
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    setSocket(newSocket);
  };

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !barcodeInput) return;

    socket.emit('scan_barcode', { pin, barcode: barcodeInput });
    setLastScan(barcodeInput);
    setBarcodeInput('');
    
    // Vibrate phone if supported
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(200);
    }
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
        <h1 className="text-2xl font-bold mb-6">Companion Scanner</h1>
        <div className="bg-white p-6 rounded shadow w-full max-w-sm">
          <label className="block text-sm font-medium text-gray-700 mb-2">Desktop PIN</label>
          <input 
            type="text" 
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full text-center text-2xl tracking-widest p-3 border rounded mb-4 focus:ring focus:border-indigo-500"
            placeholder="123456"
          />
          <button 
            onClick={() => connectToDesktop(pin)}
            disabled={pin.length < 4}
            className="w-full bg-indigo-600 text-white font-bold py-3 rounded disabled:opacity-50"
          >
            Connect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-900 text-white p-4">
      <div className="w-full flex justify-between items-center mb-8">
        <span className="font-bold text-lg">Scanner Connected</span>
        <span className="bg-green-500 text-xs px-2 py-1 rounded">LIVE</span>
      </div>

      <div className="flex-1 flex flex-col justify-center w-full max-w-sm">
        {/* Placeholder for actual Camera view */}
        <div className="aspect-square bg-black border-2 border-dashed border-gray-600 rounded-lg mb-8 flex items-center justify-center relative">
          <div className="absolute w-full h-1 bg-red-500 opacity-50 shadow-[0_0_10px_red]"></div>
          <span className="text-gray-500 text-sm">Camera viewfinder (Simulated)</span>
        </div>

        <form onSubmit={handleScan} className="flex space-x-2">
          <input 
            type="text"
            value={barcodeInput}
            onChange={e => setBarcodeInput(e.target.value)}
            placeholder="Enter Barcode"
            className="flex-1 px-4 py-3 text-black rounded"
            autoFocus
          />
          <button type="submit" className="bg-indigo-600 px-6 py-3 rounded font-bold">
            SEND
          </button>
        </form>

        {lastScan && (
          <p className="text-green-400 mt-4 text-center">Last scan sent: {lastScan}</p>
        )}
      </div>
    </div>
  );
}

export default function ScannerPage() {
  return (
    <Suspense fallback={<div>Loading scanner...</div>}>
      <ScannerApp />
    </Suspense>
  );
}
