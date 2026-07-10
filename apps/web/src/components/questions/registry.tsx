/**
 * Registre des types de questions.
 * Ajouter un type = ajouter une entrée ici + un composant : rien d'autre
 * ne change dans l'application (le backend stocke type + config en JSON).
 */
import type { ComponentType } from 'react';
import type { QuestionDto, TrileanValue } from '../../types';
import TrileanQuestion from './TrileanQuestion';

export interface QuestionComponentProps {
  question: QuestionDto;
  value: TrileanValue | undefined;
  onChange: (value: TrileanValue) => void;
}

const registry: Record<string, ComponentType<QuestionComponentProps>> = {
  trilean: TrileanQuestion,
};

export function getQuestionComponent(type: string): ComponentType<QuestionComponentProps> {
  return registry[type] ?? TrileanQuestion;
}
