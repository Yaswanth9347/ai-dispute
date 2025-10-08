export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">AI Dispute Resolver</h1>
            </div>
            <div className="flex items-center space-x-4">
              <a href="/auth/login" className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                Login
              </a>
              <a href="/auth/register" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                Get Started
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Resolve Disputes with
            <span className="text-blue-600 block">Artificial Intelligence</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Fast, fair, and AI-powered dispute resolution for civil cases. 
            Get expert mediation based on Indian law without the complexity of traditional courts.
          </p>
          <div className="space-x-4">
            <a href="/auth/register" className="inline-block px-8 py-3 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700">
              File a Dispute
            </a>
            <a href="/how-it-works" className="inline-block px-8 py-3 border border-gray-300 text-gray-700 rounded-md font-medium hover:bg-gray-50">
              How It Works
            </a>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-xl font-semibold mb-3">AI-Powered Analysis</h3>
            <p className="text-gray-600 mb-4">
              Advanced AI analyzes your case based on Indian civil law and precedents
            </p>
            <p className="text-sm text-gray-500">
              Our AI considers statements, evidence, and legal precedents to provide fair settlement options.
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-xl font-semibold mb-3">Fast Resolution</h3>
            <p className="text-gray-600 mb-4">
              Resolve disputes in days, not months or years
            </p>
            <p className="text-sm text-gray-500">
              Skip lengthy court procedures and get resolution through our streamlined AI mediation process.
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-xl font-semibold mb-3">Legal Compliance</h3>
            <p className="text-gray-600 mb-4">
              All decisions are legally binding and court-forwarding available
            </p>
            <p className="text-sm text-gray-500">
              Digital signatures and documents are legally recognized. Cases can be escalated to court if needed.
            </p>
          </div>
        </div>

        {/* Process Steps */}
        <div className="mt-20">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            How AI Dispute Resolution Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="bg-blue-500 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 text-lg font-semibold">
                1
              </div>
              <h3 className="font-semibold mb-2">File Your Case</h3>
              <p className="text-sm text-gray-600">
                Submit your dispute details, statements, and evidence through our platform
              </p>
            </div>
            <div className="text-center">
              <div className="bg-blue-500 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 text-lg font-semibold">
                2
              </div>
              <h3 className="font-semibold mb-2">Invite Other Party</h3>
              <p className="text-sm text-gray-600">
                The other party receives notification and can respond with their side of the story
              </p>
            </div>
            <div className="text-center">
              <div className="bg-blue-500 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 text-lg font-semibold">
                3
              </div>
              <h3 className="font-semibold mb-2">AI Analysis</h3>
              <p className="text-sm text-gray-600">
                Our AI analyzes all information and proposes fair settlement options
              </p>
            </div>
            <div className="text-center">
              <div className="bg-blue-500 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 text-lg font-semibold">
                4
              </div>
              <h3 className="font-semibold mb-2">Digital Settlement</h3>
              <p className="text-sm text-gray-600">
                Both parties sign the agreed settlement digitally and receive legal documents
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">AI Dispute Resolver</h3>
            <p className="text-gray-400 text-sm">
              Bringing AI-powered justice to civil disputes in India
            </p>
            <div className="mt-4 space-x-6">
              <a href="/privacy" className="text-sm text-gray-400 hover:text-white">
                Privacy Policy
              </a>
              <a href="/terms" className="text-sm text-gray-400 hover:text-white">
                Terms of Service
              </a>
              <a href="/contact" className="text-sm text-gray-400 hover:text-white">
                Contact Us
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}