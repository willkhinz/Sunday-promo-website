import React from 'react';
import { ChatPlate, PlateSpec } from './components/ChatPlate';
import plates from './plates.json';

export const Answer: React.FC = () => (
  <ChatPlate spec={plates.answer as PlateSpec} askAt={14} streamAt={48} framesPerLine={10} />
);
