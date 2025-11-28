// Performance Monitor Component - Client-side performance tracking
'use client';

import { useEffect, useState } from 'react';

interface PerformanceMetrics {
  pageLoadTime: number;
  firstPaint: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  timeToInteractive: number;
  memoryUsage?: {
    used: number;
    total: number;
    limit: number;
  };
}

export function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [showMetrics, setShowMetrics] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const collectMetrics = () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');
      
      const firstPaint = paint.find(entry => entry.name === 'first-paint');
      const fcp = paint.find(entry => entry.name === 'first-contentful-paint');

      // Get Largest Contentful Paint if available
      let lcp = 0;
      if ('PerformanceObserver' in window) {
        try {
          const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1] as any;
            lcp = lastEntry.renderTime || lastEntry.loadTime;
          });
          lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        } catch (e) {
          console.warn('LCP observer not supported');
        }
      }

      const metrics: PerformanceMetrics = {
        pageLoadTime: navigation.loadEventEnd - navigation.fetchStart,
        firstPaint: firstPaint?.startTime || 0,
        firstContentfulPaint: fcp?.startTime || 0,
        largestContentfulPaint: lcp,
        timeToInteractive: navigation.domInteractive - navigation.fetchStart
      };

      // Add memory usage if available (Chrome only)
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        metrics.memoryUsage = {
          used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
          total: Math.round(memory.totalJSHeapSize / 1024 / 1024),
          limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024)
        };
      }

      setMetrics(metrics);
    };

    // Collect metrics after page load
    if (document.readyState === 'complete') {
      collectMetrics();
    } else {
      window.addEventListener('load', collectMetrics);
    }

    // Show metrics in development mode
    if (process.env.NODE_ENV === 'development') {
      // Press Ctrl+Shift+P to toggle performance metrics
      const handleKeyPress = (e: KeyboardEvent) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'P') {
          setShowMetrics(prev => !prev);
        }
      };
      document.addEventListener('keydown', handleKeyPress);
      return () => document.removeEventListener('keydown', handleKeyPress);
    }
  }, []);

  if (!showMetrics || !metrics) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-black bg-opacity-90 text-white p-4 rounded-lg shadow-lg text-xs z-50 max-w-sm">
      <h3 className="font-bold mb-2 text-sm">Performance Metrics</h3>
      <div className="space-y-1">
        <div>
          <span className="text-gray-400">Page Load:</span>{' '}
          <span className={metrics.pageLoadTime < 2000 ? 'text-green-400' : 'text-yellow-400'}>
            {metrics.pageLoadTime.toFixed(0)}ms
          </span>
        </div>
        <div>
          <span className="text-gray-400">First Paint:</span>{' '}
          <span className={metrics.firstPaint < 1000 ? 'text-green-400' : 'text-yellow-400'}>
            {metrics.firstPaint.toFixed(0)}ms
          </span>
        </div>
        <div>
          <span className="text-gray-400">FCP:</span>{' '}
          <span className={metrics.firstContentfulPaint < 1800 ? 'text-green-400' : 'text-yellow-400'}>
            {metrics.firstContentfulPaint.toFixed(0)}ms
          </span>
        </div>
        <div>
          <span className="text-gray-400">TTI:</span>{' '}
          <span className={metrics.timeToInteractive < 3000 ? 'text-green-400' : 'text-yellow-400'}>
            {metrics.timeToInteractive.toFixed(0)}ms
          </span>
        </div>
        {metrics.memoryUsage && (
          <div>
            <span className="text-gray-400">Memory:</span>{' '}
            <span>
              {metrics.memoryUsage.used}MB / {metrics.memoryUsage.total}MB
            </span>
          </div>
        )}
      </div>
      <button
        onClick={() => setShowMetrics(false)}
        className="mt-2 text-xs text-gray-400 hover:text-white"
      >
        Close (Ctrl+Shift+P)
      </button>
    </div>
  );
}

// Web Vitals reporter hook
export function useWebVitals() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const reportWebVitals = (metric: any) => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Web Vitals] ${metric.name}:`, metric.value, metric.rating);
      }

      // Send to analytics service in production
      if (process.env.NODE_ENV === 'production') {
        // Example: Send to analytics
        // fetch('/api/analytics/web-vitals', {
        //   method: 'POST',
        //   body: JSON.stringify(metric)
        // });
      }
    };

    // Import web-vitals dynamically
    import('web-vitals').then(({ onCLS, onFID, onFCP, onLCP, onTTFB }) => {
      onCLS(reportWebVitals);
      onFID(reportWebVitals);
      onFCP(reportWebVitals);
      onLCP(reportWebVitals);
      onTTFB(reportWebVitals);
    }).catch(() => {
      console.warn('web-vitals not available');
    });
  }, []);
}

// Resource timing monitor
export function useResourceTiming() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const resource = entry as PerformanceResourceTiming;
        
        // Log slow resources (> 1 second)
        if (resource.duration > 1000) {
          console.warn(`Slow resource: ${resource.name} took ${resource.duration.toFixed(0)}ms`);
        }
      }
    });

    observer.observe({ entryTypes: ['resource'] });

    return () => observer.disconnect();
  }, []);
}