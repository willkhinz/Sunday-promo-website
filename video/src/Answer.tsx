import React from 'react';
import { ChatDemo } from './components/ChatDemo';

export const Answer: React.FC = () => (
  <ChatDemo
    navTitle="explain why my sourd..."
    query="explain why my sourdough didn't rise"
    answer="Sourdough failed to rise due to insufficient yeast activity, improper hydration, or environmental factors preventing proper fermentation. Common causes include feeding the starter too old, using water that is too hot or too cold, insufficient salt, or neglecting the necessary proofing time and temperature for yeast development. Ensure your starter is active and fed within its optimal temperature range for peak performance."
    airplaneIntro
    topGap={480}
  />
);
