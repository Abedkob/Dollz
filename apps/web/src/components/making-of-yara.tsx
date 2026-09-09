'use client';

import { useEffect, useState, useRef } from 'react';
import { Reveal } from './reveal';

const makingSteps = [
  {
    n: '01',
    title: 'A pattern, then the linen',
    body: 'She starts on paper. Each piece — body, arms, dress — is traced onto soft cotton-linen and cut by hand.',
    img: '/images/making/step-1.webp',
    alt: 'A hand-drawn doll pattern and cream linen being cut with small fabric scissors.',
  },
  {
    n: '02',
    title: 'Sewn and softly filled',
    body: 'The pieces are stitched together and stuffed a little at a time, until she can sit up on her own.',
    img: '/images/making/step-2.webp',
    alt: 'Cream linen doll body being sewn and filled with soft stuffing.',
  },
  {
    n: '03',
    title: 'The face that makes her Yara',
    body: 'Her eyes, brows and little smile are embroidered by hand; the blush is brushed on last. This is where she gets a personality.',
    img: '/images/making/step-3.webp',
    alt: 'Close-up of a doll face being hand-embroidered with brown eyes and a pink smile.',
  },
  {
    n: '04',
    title: 'Long auburn hair',
    body: 'Wavy chestnut locks are sewn down strand by strand, curled at the ends, and finished with a small white lace bow.',
    img: '/images/making/step-4.webp',
    alt: 'Long auburn doll hair being attached to the finished linen head.',
  },
  {
    n: '05',
    title: 'The rose dress, with her name',
    body: 'A dusty-rose dress with a gathered skirt, a tiny white daisy, and “Yara” embroidered across the front in white thread.',
    img: '/images/making/step-5.webp',
    alt: 'Hands embroidering the name Yara in white cursive thread on a dusty-rose dress.',
  },
];

export function MakingOfYara() {
  const [active, setActive] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-advance the slides every 5 seconds, unless the user is hovering
  useEffect(() => {
    if (isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    
    timerRef.current = setInterval(() => {
      setActive((prev) => (prev + 1) % makingSteps.length);
    }, 5000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused]);

  return (
    <section
      aria-labelledby="making-heading"
      className="bg-hero-cream px-6 pt-14 pb-20 sm:px-8 lg:px-16 lg:pt-16 lg:pb-28 xl:px-24 overflow-hidden"
    >
      <div className="mx-auto max-w-7xl">
        
        {/* Centered Header */}
        <Reveal variant="blur-in">
          <header className="mx-auto max-w-3xl text-center mb-16 lg:mb-24">
            <p className="m-0 flex items-center justify-center gap-2 font-display text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-cocoa-soft">
              <span aria-hidden="true" className="text-[0.95rem] text-rose">
                ♡
              </span>
              The making of Yara
              <span aria-hidden="true" className="text-[0.95rem] text-rose">
                ♡
              </span>
            </p>
            <h2
              id="making-heading"
              className="m-0 mt-6 font-serif! text-[2rem] font-normal! leading-[1.1] tracking-[-0.01em]! text-cocoa sm:text-[2.8rem] lg:text-[3.5rem]"
            >
              Every stitch, by hand <br className="hidden sm:block" />
              <span className="text-[#b45f74] italic">start to finish.</span>
            </h2>
          </header>
        </Reveal>

        {/* Interactive Lookbook Container */}
        <Reveal variant="rise" delay={120}>
        <div
          className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-center"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          
          {/* Left Side: Dynamic Image Canvas */}
          <div className="lg:col-span-7 relative">
            {/* Decorative background framing */}
            <div className="absolute -inset-4 bg-white/40 rounded-[2.5rem] rotate-[-2deg] shadow-sm ring-1 ring-cocoa/5 hidden lg:block" />
            <div className="absolute -inset-4 bg-white/60 rounded-[2.5rem] rotate-[1deg] shadow-sm ring-1 ring-cocoa/5 hidden lg:block" />
            
            <figure className="relative m-0 aspect-[4/3] w-full overflow-hidden rounded-[2rem] bg-white shadow-[0_20px_50px_-20px_rgba(120,70,85,0.3)] ring-1 ring-cocoa/10 z-10">
              {makingSteps.map((step, i) => (
                <img
                  key={step.n}
                  src={step.img}
                  alt={i === active ? step.alt : ''}
                  aria-hidden={i !== active}
                  width={1600}
                  height={1200}
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)]"
                  style={{ 
                    opacity: i === active ? 1 : 0,
                    transform: i === active ? 'scale(1)' : 'scale(1.05)'
                  }}
                />
              ))}
            </figure>
          </div>

          {/* Right Side: Text & Interactive Timeline */}
          <div className="lg:col-span-5 flex flex-col justify-center">
            
            {/* Cross-fading Text Container */}
            <div className="relative min-h-[220px] sm:min-h-[180px] lg:min-h-[260px]">
              {makingSteps.map((step, i) => (
                <div
                  key={step.n}
                  aria-hidden={i !== active}
                  className="absolute inset-0 flex flex-col justify-center transition-all duration-700 ease-out"
                  style={{
                    opacity: i === active ? 1 : 0,
                    visibility: i === active ? 'visible' : 'hidden',
                    transform: `translateY(${i === active ? '0px' : i < active ? '-20px' : '20px'})`
                  }}
                >
                  <span className="font-script text-[3rem] lg:text-[4rem] leading-none text-[#b45f74] drop-shadow-sm mb-2">
                    {step.n}
                  </span>
                  <h3 className="m-0 font-serif! text-[1.6rem] font-normal! tracking-[-0.01em]! text-cocoa lg:text-[2.2rem]">
                    {step.title}
                  </h3>
                  <p className="m-0 mt-4 max-w-[30rem] text-[1.05rem] leading-[1.8] text-muted">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>

            {/* Clickable Stitched Timeline */}
            <div className="mt-12 lg:mt-16">
              <div className="flex justify-between items-center relative">
                {/* Background dashed seam */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full border-t-2 border-dashed border-[#cbb7a2]/50 z-0" />
                
                {/* Interactive Steps */}
                {makingSteps.map((step, i) => (
                  <button
                    key={step.n}
                    onClick={() => setActive(i)}
                    aria-label={`Go to step ${step.n}: ${step.title}`}
                    aria-current={i === active ? 'step' : undefined}
                    className="relative z-10 group flex flex-col items-center gap-3 p-2 focus:outline-none"
                  >
                    {/* The Dot / Pin */}
                    <div 
                      className={`h-4 w-4 rounded-full border-2 transition-all duration-300 shadow-sm ${
                        i === active 
                          ? 'border-[#b45f74] bg-[#b45f74] scale-125' 
                          : 'border-[#cbb7a2] bg-hero-cream group-hover:border-[#b45f74] group-hover:scale-110'
                      }`} 
                    />
                    {/* Number Label (only visible on active or hover) */}
                    <span 
                      className={`absolute top-8 font-display text-[0.7rem] font-bold tracking-widest transition-all duration-300 ${
                        i === active ? 'text-cocoa opacity-100 translate-y-0' : 'text-cocoa-soft opacity-0 -translate-y-2 group-hover:opacity-100'
                      }`}
                    >
                      {step.n}
                    </span>
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>
        </Reveal>
      </div>
    </section>
  );
}