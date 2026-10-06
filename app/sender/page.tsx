'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { calculateQuote } from '@/lib/pricing/quote';
import type { QuoteResult, SizeClass } from '@/types/database.types';

// Dynamically import map to avoid SSR issues with maplibregl
const Map = dynamic(() => import('@/components/map/Map'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#121212] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )
});

type Step = 'SELECT_PICKUP' | 'SELECT_DROPOFF' | 'PACKAGE_DETAILS' | 'CONFIRMING';

export default function SenderDashboard() {
  const [step, setStep] = useState<Step>('SELECT_PICKUP');
  
  const [pickup, setPickup] = useState<{ lat: number; lng: number } | null>(null);
  const [dropoff, setDropoff] = useState<{ lat: number; lng: number } | null>(null);
  
  const [weightKg, setWeightKg] = useState<number>(2);
  const [sizeClass, setSizeClass] = useState<SizeClass>('M');
  const [description, setDescription] = useState('');
  
  const [quote, setQuote] = useState<QuoteResult | null>(null);

  const handleMapClick = (lngLat: { lng: number; lat: number }) => {
    if (step === 'SELECT_PICKUP') {
      setPickup(lngLat);
    } else if (step === 'SELECT_DROPOFF') {
      setDropoff(lngLat);
    }
  };

  const getMarkers = () => {
    const m = [];
    if (pickup) m.push({ id: 'pickup', ...pickup, color: '#4f46e5' }); // Indigo
    if (dropoff) m.push({ id: 'dropoff', ...dropoff, color: '#10b981' }); // Emerald
    return m;
  };

  const handleNext = () => {
    if (step === 'SELECT_PICKUP' && pickup) setStep('SELECT_DROPOFF');
    else if (step === 'SELECT_DROPOFF' && dropoff) setStep('PACKAGE_DETAILS');
    else if (step === 'PACKAGE_DETAILS') {
      // Calculate Quote
      const res = calculateQuote({
        pickupLat: pickup!.lat,
        pickupLng: pickup!.lng,
        dropoffLat: dropoff!.lat,
        dropoffLng: dropoff!.lng,
        weightKg,
        sizeClass,
      });
      setQuote(res);
      setStep('CONFIRMING');
    }
  };

  const reset = () => {
    setPickup(null);
    setDropoff(null);
    setQuote(null);
    setStep('SELECT_PICKUP');
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row relative">
      {/* Map Area */}
      <div className="flex-1 relative min-h-[50vh] md:min-h-0">
        <Map 
          markers={getMarkers()} 
          onMapClick={handleMapClick}
        />
        
        {/* Instruction overlay on map */}
        {(step === 'SELECT_PICKUP' || step === 'SELECT_DROPOFF') && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 glass-panel px-6 py-3 rounded-full z-10 font-medium shadow-lg whitespace-nowrap">
            {step === 'SELECT_PICKUP' ? 'Tap map to set Pickup' : 'Tap map to set Dropoff'}
          </div>
        )}
      </div>

      {/* Control Panel */}
      <div className="w-full md:w-96 bg-[#121212] border-t md:border-t-0 md:border-l border-[#ffffff15] flex flex-col shadow-2xl z-20 transition-all duration-300">
        <div className="p-6 flex-1 overflow-y-auto">
          {step === 'PACKAGE_DETAILS' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-xl font-bold text-white mb-4">Package Details</h2>
              
              <div>
                <label className="block text-sm font-medium text-[#9ca3af] mb-2">Description</label>
                <input 
                  type="text" 
                  placeholder="e.g. 2 books, small box" 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#9ca3af] mb-2">Weight (kg)</label>
                  <input 
                    type="number" 
                    min="0.1"
                    step="0.1"
                    value={weightKg}
                    onChange={(e) => setWeightKg(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#9ca3af] mb-2">Size</label>
                  <select 
                    value={sizeClass}
                    onChange={(e) => setSizeClass(e.target.value as SizeClass)}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 appearance-none"
                  >
                    <option value="S">Small (Envelope)</option>
                    <option value="M">Medium (Shoebox)</option>
                    <option value="L">Large (Microwave)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 'CONFIRMING' && quote && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-2xl font-bold text-white mb-2">Review & Post</h2>
              
              <div className="glass-panel p-5 space-y-4">
                <div className="flex justify-between items-end border-b border-[#333] pb-4">
                  <div>
                    <p className="text-sm text-[#9ca3af]">Distance</p>
                    <p className="font-semibold text-lg">{quote.distance_km} km</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-[#9ca3af]">Total Fare</p>
                    <p className="font-bold text-3xl text-emerald-400">Rs {quote.suggested_price_pkr}</p>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-[#9ca3af]">
                    <span>Base Fare</span>
                    <span>Rs {quote.breakdown.base}</span>
                  </div>
                  <div className="flex justify-between text-[#9ca3af]">
                    <span>Distance Fee</span>
                    <span>Rs {quote.breakdown.distance_fee}</span>
                  </div>
                  {quote.breakdown.weight_fee > 0 && (
                    <div className="flex justify-between text-[#9ca3af]">
                      <span>Weight Fee</span>
                      <span>Rs {quote.breakdown.weight_fee}</span>
                    </div>
                  )}
                  {quote.breakdown.size_fee > 0 && (
                    <div className="flex justify-between text-[#9ca3af]">
                      <span>Size Fee</span>
                      <span>Rs {quote.breakdown.size_fee}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Bottom Bar */}
        <div className="p-6 border-t border-[#333] bg-[#121212]">
          <div className="flex gap-3">
            {step !== 'SELECT_PICKUP' && (
              <button 
                onClick={reset}
                className="px-4 py-3 rounded-xl border border-[#333] text-[#9ca3af] hover:bg-[#1a1a1a] hover:text-white transition-colors"
              >
                Reset
              </button>
            )}
            
            <button
              onClick={step === 'CONFIRMING' ? () => alert('Mock: Posting to DB...') : handleNext}
              disabled={
                (step === 'SELECT_PICKUP' && !pickup) || 
                (step === 'SELECT_DROPOFF' && !dropoff) ||
                (step === 'PACKAGE_DETAILS' && !description)
              }
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed hover-lift transition-all"
            >
              {step === 'SELECT_PICKUP' ? 'Set Pickup' : 
               step === 'SELECT_DROPOFF' ? 'Set Dropoff' : 
               step === 'PACKAGE_DETAILS' ? 'Get Quote' : 
               'Post Delivery Request'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
