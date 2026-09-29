import { Card, Button, Typography, Row, Col, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { 
  BulbOutlined, 
  ThunderboltOutlined, 
  HomeOutlined, 
  CalculatorOutlined,
  ArrowRightOutlined 
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

export default function DemoLanding() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-6">
      <div className="max-w-5xl w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="bg-yellow-100 rounded-full p-4">
              <BulbOutlined className="text-5xl text-yellow-600" />
            </div>
          </div>
          <Title level={1} className="!mb-2">
            Slar CRM - Solar Designer Demo
          </Title>
          <Paragraph className="text-lg text-apple-textMuted">
            Experience our advanced 3D solar roof designer with real-time calculations
          </Paragraph>
        </div>

        {/* Feature Cards */}
        <Row gutter={[24, 24]}>
          <Col xs={24} md={8}>
            <Card 
              bordered={false} 
              className="shadow-lg hover:shadow-xl transition-shadow h-full"
              hoverable
            >
              <div className="text-center space-y-3">
                <HomeOutlined className="text-4xl text-blue-600" />
                <Title level={4}>Roof Mapping</Title>
                <Text className="text-apple-textMuted">
                  Draw your roof on satellite imagery with precision polygon tools
                </Text>
              </div>
            </Card>
          </Col>

          <Col xs={24} md={8}>
            <Card 
              bordered={false} 
              className="shadow-lg hover:shadow-xl transition-shadow h-full"
              hoverable
            >
              <div className="text-center space-y-3">
                <ThunderboltOutlined className="text-4xl text-green-600" />
                <Title level={4}>Auto Panel Layout</Title>
                <Text className="text-apple-textMuted">
                  AI-powered panel placement with shadow analysis and optimization
                </Text>
              </div>
            </Card>
          </Col>

          <Col xs={24} md={8}>
            <Card 
              bordered={false} 
              className="shadow-lg hover:shadow-xl transition-shadow h-full"
              hoverable
            >
              <div className="text-center space-y-3">
                <CalculatorOutlined className="text-4xl text-purple-600" />
                <Title level={4}>3D Visualization</Title>
                <Text className="text-apple-textMuted">
                  Interactive 3D preview with sun simulation and shading analysis
                </Text>
              </div>
            </Card>
          </Col>
        </Row>

        {/* CTA */}
        <Card bordered={false} className="shadow-xl bg-gradient-to-r from-blue-600 to-green-600 text-white">
          <div className="text-center space-y-4 py-4">
            <Title level={3} className="!text-white !mb-2">
              Ready to Design Your Solar System?
            </Title>
            <Paragraph className="text-blue-50 text-lg">
              No login required • Free to use • Full features enabled
            </Paragraph>
            <Space size="large">
              <Button 
                type="primary" 
                size="large" 
                icon={<ArrowRightOutlined />}
                onClick={() => navigate('/demo/solar-designer')}
                className="!bg-apple-cardLight dark:bg-apple-cardDark !text-blue-600 !border-white hover:!bg-blue-50 !h-12 !px-8 !text-lg !font-semibold"
              >
                Launch Solar Designer
              </Button>
              <Button 
                size="large" 
                onClick={() => navigate('/login')}
                className="!bg-transparent !text-white !border-white hover:!bg-apple-cardLight dark:bg-apple-cardDark/10 !h-12 !px-8"
              >
                Login to Full CRM
              </Button>
            </Space>
          </div>
        </Card>

        {/* Features List */}
        <Card bordered={false} className="shadow-lg">
          <Title level={4} className="!mb-4">What You Can Do:</Title>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Space direction="vertical" size="small" className="w-full">
                <Text>✅ Draw roof polygons on satellite maps</Text>
                <Text>✅ Mark obstructions (water tanks, AC units)</Text>
                <Text>✅ Select from 15+ panel models</Text>
                <Text>✅ Choose portrait or landscape orientation</Text>
              </Space>
            </Col>
            <Col xs={24} md={12}>
              <Space direction="vertical" size="small" className="w-full">
                <Text>✅ Auto-generate optimal panel layout</Text>
                <Text>✅ View 3D roof with placed panels</Text>
                <Text>✅ Simulate sun position & shadows</Text>
                <Text>✅ Calculate system size & efficiency</Text>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* Footer */}
        <div className="text-center text-apple-textMuted text-sm">
          <Text type="secondary">
            Powered by Three.js, Leaflet, and advanced solar calculation algorithms
          </Text>
        </div>
      </div>
    </div>
  );
}
