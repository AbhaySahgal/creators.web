import { useEffect, type ReactNode } from 'react';
import { useDragScroll } from '../../hooks/useDragScroll';

interface HorizontalScrollStripProps {
	children: ReactNode;
	className?: string;
}

/**
 * Horizontal carousel — same pattern as Explore live/trending strips.
 * Outer clip keeps the row width-bound so overflow-x can scroll on all viewports.
 */
export function HorizontalScrollStrip({ children, className = '' }: HorizontalScrollStripProps) {
	const scrollRef = useDragScroll();

	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;

		const onWheel = (e: WheelEvent) => {
			if (el.scrollWidth <= el.clientWidth) return;

			const delta =
				Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
			if (delta === 0) return;

			const atStart = el.scrollLeft <= 0;
			const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
			if ((delta < 0 && atStart) || (delta > 0 && atEnd)) return;

			el.scrollLeft += delta;
			e.preventDefault();
		};

		el.addEventListener('wheel', onWheel, { passive: false });
		return () => el.removeEventListener('wheel', onWheel);
	}, [scrollRef]);

	return (
		<div className="w-full min-w-0 overflow-hidden">
			<div
				ref={scrollRef}
				className={
					`flex flex-nowrap gap-3 w-full min-w-0 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 ` +
					`[&>*]:shrink-0 ${className}`.trim()
				}
			>
				{children}
			</div>
		</div>
	);
}
