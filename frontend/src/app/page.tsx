"use client"
import React from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function HomePage(): JSX.Element {
  const router = useRouter()

  return (
    <main className="min-h-screen bg-hero-light dark:bg-hero-dark flex items-center">
      <div className="w-full max-w-6xl mx-auto p-6 lg:p-12">
        <div className="flex flex-col lg:flex-row items-center gap-12">

          {/* Left column - content */}
          <section className="flex-1 text-center lg:text-left">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
              AI Disputes Resolver
            </h1>
            <p className="mt-4 max-w-xl text-lg text-slate-700 dark:text-slate-300">
              Empowering you with AI-driven solutions for legal disputes.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center sm:justify-start gap-4">
              <button
                onClick={() => router.push('/auth/login')}
                className="btn-primary"
              >
                Get Started
              </button>

              <button
                onClick={() => router.push('/auth/register')}
                className="btn-ghost"
              >
                Learn More
              </button>
            </div>

            {/* subtle feature badges */}
            <div className="mt-8 flex flex-wrap gap-3 justify-center lg:justify-start">
              <span className="badge">AI-driven</span>
              <span className="badge">India-focused</span>
              <span className="badge">Confidential</span>
            </div>
          </section>

          {/* Right column - illustration card */}
          <aside className="flex-1 flex justify-center lg:justify-end">
            <div className="glass-card relative w-72 h-96 sm:w-80 sm:h-[28rem] rounded-[50%] shadow-xl flex items-center justify-center overflow-hidden">
              <Image src="/Dispute.png" alt="Dispute Resolver" width={320} height={320} className="object-cover rounded-[50%]" />
            </div>
          </aside>
        </div> 

        {/* Disclaimer section without box */}
        <div className="mt-12 mx-auto max-w-10xl">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 text-center">Disclaimer</h3>
          <p className="mt-2 text-slate-700 dark:text-slate-300 leading-8 text-xl text-center w-full max-w-7xl">
            This <strong>AI Dispute Resolver</strong> is designed to facilitate the resolution of civil and minor disputes in a fair, efficient, and sustainable manner. It does not cover criminal cases. The platform is not a substitute for a judge or any legal authority, nor does it render judgments on right or wrong. Instead, it responsibly analyzes each issue and offers equitable solutions grounded in <strong>Indian law</strong> to help users resolve their disputes effectively. For complex or serious legal concerns, users are encouraged to consult a qualified legal professional.
          </p>
        </div>
      </div>

      {/* Inline styles (Tailwind-first, with minimal custom CSS) */}
      <style jsx>{`
        :root {
          --glass-bg: rgba(255, 255, 255, 0.36);
          --glass-border: rgba(255,255,255,0.6);
        }

        .bg-hero-light {
          background: linear-gradient(135deg, #f0f9ff 0%, #eef2ff 50%, #fdf2f8 100%);
        }

        .dark .bg-hero-dark {
          background: radial-gradient(1200px circle at 10% 10%, #0f172a 0%, #0b1220 30%, #07102a 100%);
        }

        .glass-card {
          background: linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
          border: 1px solid rgba(255,255,255,0.06);
          backdrop-filter: blur(8px) saturate(1.1);
          transition: transform 0.6s cubic-bezier(.2,.9,.2,1), box-shadow 0.3s;
        }

        .glass-card:hover { transform: translateY(-8px) rotate(-1deg); box-shadow: 0 20px 50px rgba(2,6,23,0.45); }

        .floating-ornament {
          position: absolute; width: 220px; height: 220px; border-radius: 50%;
          background: radial-gradient(circle at 30% 30%, rgba(99,102,241,0.18), rgba(16,185,129,0.06));
          filter: blur(28px);
          transform: translateY(-20px) rotate(10deg);
        }

        .btn-primary {
          display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
          padding: 0.75rem 1.25rem; font-weight: 700; border-radius: 9999px;
          background: linear-gradient(90deg,#6366f1,#06b6d4); color: white; box-shadow: 0 8px 24px rgba(99,102,241,0.18);
          border: none; cursor: pointer; transition: transform .18s ease, box-shadow .18s ease;
        }
        .btn-primary:hover { transform: translateY(-3px); box-shadow: 0 18px 40px rgba(99,102,241,0.22); }

        .btn-ghost {
          padding: 0.75rem 1.25rem; font-weight: 700; border-radius: 9999px;
          background: rgba(255,255,255,0.9); color: #374151; border: 1px solid rgba(15,23,42,0.06);
          cursor: pointer; transition: transform .18s ease, box-shadow .18s ease;
        }
        .btn-ghost:hover { transform: translateY(-3px); box-shadow: 0 12px 30px rgba(2,6,23,0.06); }

        .badge {
          display: inline-block; padding: 0.35rem 0.6rem; font-weight: 600; border-radius: 9999px; font-size: 0.85rem;
          background: linear-gradient(90deg, rgba(99,102,241,0.12), rgba(6,182,212,0.06)); color: #0f172a;
          border: 1px solid rgba(99,102,241,0.06);
        }

        .disclaimer-card {
          background: linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,255,255,0.85));
          border: 1px solid rgba(15,23,42,0.04); box-shadow: 0 12px 40px rgba(2,6,23,0.06);
        }

        :global(.dark) .disclaimer-card {
          background: linear-gradient(180deg, rgba(8,10,20,0.6), rgba(8,10,20,0.5));
          border: 1px solid rgba(255,255,255,0.04);
        }

        .icon-wrap { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 10px; background: rgba(99,102,241,0.08); color: #6366f1; }

        @media (min-width: 1024px) {
          main { padding: 3rem 0; }
        }
      `}</style>
    </main>
  )
}
