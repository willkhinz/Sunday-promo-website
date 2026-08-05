import React from 'react';
import { ChatPlate, PlateSpec } from './components/ChatPlate';
import plates from './plates.json';

export const Hero: React.FC = () => (
  <ChatPlate spec={plates.hero as PlateSpec} askAt={12} streamAt={44} framesPerLine={9} />
);
