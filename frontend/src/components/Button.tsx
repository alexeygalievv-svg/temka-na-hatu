import { motion, type HTMLMotionProps } from 'framer-motion';
import { haptic } from '../telegram';

type Variant = 'primary' | 'ghost' | 'danger';

interface ButtonProps extends HTMLMotionProps<'button'> {
  variant?: Variant;
  wide?: boolean;
}

export function Button({ variant = 'primary', wide, className, onClick, children, ...rest }: ButtonProps) {
  return (
    <motion.button
      className={['btn', `btn--${variant}`, wide ? 'btn--wide' : '', className ?? ''].join(' ')}
      whileHover={{ y: -1.5 }}
      whileTap={{ scale: 0.96, y: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 26 }}
      onClick={(e) => {
        haptic('light');
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
