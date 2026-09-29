import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, Row, Col, Statistic, Tag, Divider, Spin, Alert, Button } from 'antd';
import { 
  Sun, Zap, DollarSign, TrendingUp, Leaf, Calendar,
  Award, Shield, Phone, Mail, MapPin 
} from 'lucide-react';
import ProposalChatbot from '../../components/proposal/ProposalChatbot';
import { api } from '../../lib/api';

const { Title, Text, Paragraph } = Typography;
import { Typography } from 'antd';

export default function ProposalViewer() {
  const { token } = useParams<{ token: string }>();

  const { data: proposal, isLoading, error } = useQuery({
    queryKey: ['public-proposal', token],
    queryFn: () => api.get(`/proposals/public/${token}`).then(r => r.data.data),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spin size="large" />
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <Alert
          message="Proposal Not Found"
          description="This proposal link is invalid or has expired. Please contact your salesperson for a new link."
          type="error"
          showIcon
        />
      </div>
    );
  }

  const customer = proposal.customer || proposal.lead;
  const salesperson = proposal.createdBy;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center gap-3 mb-4">
            <Sun size={40} />
            <div>
              <Title level={2} className="!text-white !mb-0">
                Solar Installation Proposal
              </Title>
              <Text className="text-blue-100">
                Prepared for {customer.name}
              </Text>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4 mt-6">
            <Tag color="gold" className="text-base px-4 py-1">
              <Zap size={16} className="inline mr-1" />
              {proposal.systemSizeKw} kW System
            </Tag>
            <Tag color="green" className="text-base px-4 py-1">
              <Leaf size={16} className="inline mr-1" />
              {proposal.panelCount} Solar Panels
            </Tag>
            <Tag color="blue" className="text-base px-4 py-1">
              <Calendar size={16} className="inline mr-1" />
              {new Date(proposal.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </Tag>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Key Metrics */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Card className="text-center shadow-md hover:shadow-lg transition">
              <Statistic
                title="System Size"
                value={proposal.systemSizeKw}
                suffix="kW"
                valueStyle={{ color: '#1890ff' }}
                prefix={<Zap size={24} />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card className="text-center shadow-md hover:shadow-lg transition">
              <Statistic
                title="Net Cost"
                value={proposal.netCost}
                prefix="₹"
                valueStyle={{ color: '#52c41a' }}
                formatter={(value) => `${Number(value).toLocaleString('en-IN')}`}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card className="text-center shadow-md hover:shadow-lg transition">
              <Statistic
                title="Payback Period"
                value={proposal.paybackYears}
                suffix="years"
                valueStyle={{ color: '#faad14' }}
                prefix={<TrendingUp size={24} />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card className="text-center shadow-md hover:shadow-lg transition">
              <Statistic
                title="25-Year Savings"
                value={Math.round(proposal.lifetimeSavings / 100000)}
                suffix="Lakhs"
                prefix="₹"
                valueStyle={{ color: '#eb2f96' }}
              />
            </Card>
          </Col>
        </Row>

        {/* System Specifications */}
        <Card title={<><Sun className="inline mr-2" />System Specifications</>} className="shadow-md">
          <Row gutter={[24, 16]}>
            <Col xs={24} md={12}>
              <div className="space-y-3">
                <div className="flex justify-between border-b pb-2">
                  <Text strong>Solar Panels</Text>
                  <Text>{proposal.panelBrand} {proposal.panelModel}</Text>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <Text strong>Panel Count</Text>
                  <Text>{proposal.panelCount} panels × {proposal.panelWattage}W</Text>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <Text strong>Inverter</Text>
                  <Text>{proposal.inverterBrand} {proposal.inverterModel}</Text>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <Text strong>Inverter Capacity</Text>
                  <Text>{proposal.inverterCapacity} kW</Text>
                </div>
              </div>
            </Col>
            <Col xs={24} md={12}>
              <div className="space-y-3">
                <div className="flex justify-between border-b pb-2">
                  <Text strong>Structure Type</Text>
                  <Text>{proposal.structureType || 'Standard'}</Text>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <Text strong>Roof Type</Text>
                  <Text>{proposal.roofType || 'Not specified'}</Text>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <Text strong>DCR Compliant</Text>
                  <Text>{proposal.isDCR ? 'Yes ✓' : 'No'}</Text>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <Text strong>Annual Generation</Text>
                  <Text className="text-green-600 font-semibold">
                    {proposal.annualGeneration?.toLocaleString('en-IN')} kWh/year
                  </Text>
                </div>
              </div>
            </Col>
          </Row>
        </Card>

        {/* Financial Breakdown */}
        <Card title={<><DollarSign className="inline mr-2" />Financial Details</>} className="shadow-md">
          <div className="space-y-4">
            <div className="flex justify-between text-lg">
              <Text>Total System Cost</Text>
              <Text strong>₹{proposal.totalCost?.toLocaleString('en-IN')}</Text>
            </div>
            <div className="flex justify-between text-lg text-green-600">
              <Text className="text-green-600">Subsidy Amount</Text>
              <Text strong>- ₹{proposal.subsidyAmount?.toLocaleString('en-IN')}</Text>
            </div>
            <Divider className="!my-2" />
            <div className="flex justify-between text-xl">
              <Text strong>Net Cost (After Subsidy)</Text>
              <Text strong className="text-blue-600">
                ₹{proposal.netCost?.toLocaleString('en-IN')}
              </Text>
            </div>

            {proposal.loanApplicable && (
              <>
                <Divider />
                <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                  <Text strong className="text-blue-800">Loan Details</Text>
                  <div className="flex justify-between">
                    <Text>Monthly EMI</Text>
                    <Text strong>₹{proposal.emi?.toLocaleString('en-IN')}</Text>
                  </div>
                  <div className="flex justify-between">
                    <Text>Loan Tenure</Text>
                    <Text>{Math.round(proposal.loanTenure / 12)} years</Text>
                  </div>
                  <div className="flex justify-between">
                    <Text>Interest Rate</Text>
                    <Text>{proposal.loanRate}% per annum</Text>
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Environmental Impact */}
        <Card title={<><Leaf className="inline mr-2" />Environmental Impact</>} className="shadow-md bg-green-50">
          <Row gutter={[24, 16]}>
            <Col xs={24} md={12}>
              <div className="text-center p-4">
                <div className="text-4xl font-bold text-green-600">
                  {proposal.co2Savings}
                </div>
                <Text className="text-gray-600">Tonnes of CO₂ Saved</Text>
                <Paragraph className="text-sm text-gray-500 mt-2">
                  Over 25 years of operation
                </Paragraph>
              </div>
            </Col>
            <Col xs={24} md={12}>
              <div className="text-center p-4">
                <div className="text-4xl font-bold text-green-600">
                  {Math.round(proposal.co2Savings * 1000 / 22)}
                </div>
                <Text className="text-gray-600">Trees Equivalent</Text>
                <Paragraph className="text-sm text-gray-500 mt-2">
                  Same impact as planting this many trees
                </Paragraph>
              </div>
            </Col>
          </Row>
        </Card>

        {/* Warranty Information */}
        <Card title={<><Shield className="inline mr-2" />Warranty & Support</>} className="shadow-md">
          <Row gutter={[24, 16]}>
            <Col xs={24} md={8}>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <Award size={32} className="mx-auto text-blue-600 mb-2" />
                <Text strong className="block">Solar Panels</Text>
                <Text className="text-sm">25-year performance</Text>
                <Text className="text-sm block">10-year product</Text>
              </div>
            </Col>
            <Col xs={24} md={8}>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <Award size={32} className="mx-auto text-green-600 mb-2" />
                <Text strong className="block">Inverter</Text>
                <Text className="text-sm">5-year warranty</Text>
              </div>
            </Col>
            <Col xs={24} md={8}>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <Award size={32} className="mx-auto text-yellow-600 mb-2" />
                <Text strong className="block">Installation</Text>
                <Text className="text-sm">1-year workmanship</Text>
              </div>
            </Col>
          </Row>
        </Card>

        {/* Contact Information */}
        <Card title="Your Solar Consultant" className="shadow-md">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-2xl font-bold text-blue-600">
              {salesperson.name.charAt(0)}
            </div>
            <div className="flex-1">
              <Text strong className="text-lg block">{salesperson.name}</Text>
              <div className="flex flex-wrap gap-4 mt-2">
                <Button 
                  type="link" 
                  icon={<Phone size={16} />}
                  onClick={() => window.open(`tel:${salesperson.phone}`)}
                  className="!p-0"
                >
                  {salesperson.phone}
                </Button>
                <Button 
                  type="link" 
                  icon={<Mail size={16} />}
                  onClick={() => window.open(`mailto:${salesperson.email}`)}
                  className="!p-0"
                >
                  {salesperson.email}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm py-6">
          <Text type="secondary">
            This proposal is valid for 30 days from the date of generation.
          </Text>
        </div>
      </div>

      {/* AI Chatbot Widget */}
      <ProposalChatbot
        proposalId={proposal.id}
        token={token!}
        salespersonName={salesperson.name}
        salespersonPhone={salesperson.phone}
      />
    </div>
  );
}
