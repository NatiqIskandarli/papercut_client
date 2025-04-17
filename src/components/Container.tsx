import React from 'react';
import '@/styles/Container.css';

interface ContainerProps {
  className?: string;
  children: React.ReactNode;
}

const Container: React.FC<ContainerProps> = ({ className, children }) => {
  return <div className={`container-layout ${className || ''}`}>{children}</div>;
};

export default Container;
