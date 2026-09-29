import React from 'react';
import { useNavigate } from 'react-router-dom';

interface CustomerLinkProps {
  name: string;
  customerId: string;
  customerCode?: string;
}

export const CustomerLink: React.FC<CustomerLinkProps> = ({ name, customerId, customerCode }) => {
  const navigate = useNavigate();

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div 
        className="font-semibold text-blue-600 cursor-pointer hover:underline inline-block" 
        onClick={() => navigate(`/customer/${customerId}`)}
      >
        {name}
      </div>
      {customerCode && <div className="text-xs text-apple-textMuted font-mono">{customerCode}</div>}
    </div>
  );
};

export default CustomerLink;
