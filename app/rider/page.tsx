'use client';

import { useState } from 'react';
import { useRiderHeartbeat } from '@/hooks/useRiderHeartbeat';
import { useWakeLock } from '@/hooks/useWakeLock';

export default function RiderDashboard() {
  const [enabled, setEnabled] = useState(false);
  
  // Using a mock riderId for UI development before auth is wired up
  const mockRiderId = "mock-uuid-1234";

  const heartbeat = useRiderHeartbeat({
    riderId: mockRiderId,
    enabled: enabled,
  });

  const toggleOnline = async () => {
    if (enabled) {
      await heartbeat.goOffline();
      setEnabled(false);
    } else {
      await heartbeat.goOnline();
      setEnabled(true);
    }
  };

  // Mock incoming requests
  const requests = enabled ? [
    {
      id: '1',
      distance: '1.2 km away',
      tripDistance: '4.5 km trip',
      price: 250,
      weight: '2 kg',
      size: 'Medium',
      expiresIn: 45
    },
    {
      id: '2',
      distance: '3.0 km away',
      tripDistance: '8.1 km trip',
      price: 380,
      weight: '5 kg',
      size: 'Large',
      expiresIn: 12
    }
  ] : [];

  return (
    <div className="flex flex-col space-y-6 h-full">
      {/* Status Bar */}
      <div className="glass-panel p-6 flex flex-col items-center text-center space-y-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-4 w-4">
            {enabled && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
            <span className={`relative inline-flex rounded-full h-4 w-4 ${enabled ? 'bg-emerald-500' : 'bg-gray-500'}`}></span>
          </span>
          <h2 className="text-xl font-bold text-white">
            {enabled ? 'You are Online' : 'You are Offline'}
          </h2>
        </div>
        
        <p className="text-[#9ca3af] text-sm">
          {enabled 
            ? 'Waiting for delivery requests...' 
            : 'Go online to start receiving delivery requests.'}
        </p>

        <button
          onClick={toggleOnline}
          className={`w-full py-4 rounded-xl font-bold text-lg hover-lift transition-all shadow-lg ${
            enabled 
              ? 'bg-[#1a1a1a] border border-[#333] text-[#f3f4f6] hover:bg-[#222]' 
              : 'bg-emerald-600 text-white shadow-emerald-500/25 hover:bg-emerald-500'
          }`}
        >
          {enabled ? 'Go Offline' : 'Go Online'}
        </button>

        {enabled && heartbeat.wakeLockActive && (
          <div className="text-xs text-emerald-400/80 bg-emerald-400/10 px-3 py-1 rounded-full">
            Display kept awake
          </div>
        )}
      </div>

      {/* Requests Feed */}
      <div className="flex-1 space-y-4">
        <h3 className="text-sm font-semibold text-[#6b7280] uppercase tracking-wider">
          Incoming Requests
        </h3>
        
        {requests.length === 0 ? (
          <div className="text-center py-10 text-[#6b7280]">
            {enabled ? 'No requests nearby right now.' : 'Go online to see requests.'}
          </div>
        ) : (
          requests.map(req => (
            <div key={req.id} className="glass-panel p-5 space-y-4 animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-emerald-400 font-bold text-xl">Rs {req.price}</p>
                  <p className="text-sm text-[#9ca3af] mt-1">{req.tripDistance}</p>
                </div>
                <div className="text-right">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-full border-2 border-[#333] font-bold text-white">
                    {req.expiresIn}
                  </div>
                  <p className="text-xs text-[#6b7280] mt-1">seconds</p>
                </div>
              </div>
              
              <div className="flex gap-4 text-sm text-[#9ca3af] bg-[#1a1a1a] p-3 rounded-lg border border-[#333]">
                <div><span className="text-white font-medium">{req.weight}</span> package</div>
                <div>•</div>
                <div><span className="text-white font-medium">{req.size}</span> size</div>
              </div>
              
              <div className="flex gap-3 pt-2">
                <button className="flex-1 py-3 rounded-xl border border-[#333] text-white hover:bg-[#1a1a1a] transition-colors">
                  Skip
                </button>
                <button className="flex-[2] py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 shadow-lg shadow-emerald-500/25 hover-lift transition-all">
                  Accept Delivery
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
