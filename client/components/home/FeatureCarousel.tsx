"use client";

import { motion, AnimatePresence } from "framer-motion";
import Card, { CardBody } from "@/components/ui/Card";
import { carouselSlides } from "@/lib/feature-carousel-content";
import { useFeatureCarouselController } from "@/hooks/useFeatureCarouselController";

export default function FeatureCarousel() {
  const { activeIndex, setActiveIndex } = useFeatureCarouselController(carouselSlides.length, 5000);

  return (
    <Card className="overflow-hidden backdrop-blur-sm shadow-none">
      <CardBody className="p-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIndex}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.4 }}
            className={`bg-gradient-to-br ${carouselSlides[activeIndex].gradient} p-8 md:p-10`}
          >
            <div className="mb-4 text-5xl">{carouselSlides[activeIndex].icon}</div>
            <h3 className="mb-3 font-serif text-2xl font-bold text-[var(--text-primary)]">
              {carouselSlides[activeIndex].title}
            </h3>
            <p className="max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
              {carouselSlides[activeIndex].description}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Dots */}
        <div className="flex items-center justify-center gap-2 pb-5 pt-3">
          {carouselSlides.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={`h-2 rounded-full transition-all duration-300 ${i === activeIndex
                ? "w-6 bg-[var(--accent-gold)]"
                : "w-2 bg-white/20 hover:bg-white/30"
                }`}
            />
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
