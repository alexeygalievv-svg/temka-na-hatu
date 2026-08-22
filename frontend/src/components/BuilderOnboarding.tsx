import { motion } from 'framer-motion';
import { Button } from './Button';

interface BuilderOnboardingProps {
  onStart: () => void;
}

export function BuilderOnboarding({ onStart }: BuilderOnboardingProps) {
  const steps = [
    'Дважды коснитесь карты — отметьте место',
    'Добавьте фото и расскажите историю',
    'Расставьте точки в нужном порядке',
    'Отправьте ссылку близкому человеку',
  ];

  return (
    <motion.div
      className="builder-onboarding"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="builder-onboarding__card"
        initial={{ opacity: 0, y: 28, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 28 }}
      >
        <motion.span
          className="builder-onboarding__eyebrow"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          Карта воспоминаний
        </motion.span>

        <motion.h1
          className="builder-onboarding__title"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.55 }}
        >
          Соберите карту<br />ваших мест
        </motion.h1>

        <motion.ul
          className="builder-onboarding__steps"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.5 }}
        >
          {steps.map((step, i) => (
            <motion.li
              key={step}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.08, duration: 0.45 }}
            >
              <span className="builder-onboarding__step-num">{i + 1}</span>
              {step}
            </motion.li>
          ))}
        </motion.ul>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85, duration: 0.5 }}
        >
          <Button wide onClick={onStart}>
            Начать
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
