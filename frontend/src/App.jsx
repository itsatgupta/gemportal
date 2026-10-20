import { Search, FileText, Scale, CheckSquare, LayoutDashboard } from 'lucide-react'
import useBidStore from './store/bidStore'
import useAgentSocket from './hooks/useAgentSocket'
import Header from './components/layout/Header'
import Sidebar from './components/layout/Sidebar'
import AgentStatusBar from './components/layout/AgentStatusBar'
import SearchTab from './components/tabs/SearchTab'
import ProposalTab from './components/tabs/ProposalTab'
import AssessmentTab from './components/tabs/AssessmentTab'
import SummaryTab from './components/tabs/SummaryTab'
import DashboardTab from './components/tabs/DashboardTab'
import ToastContainer from './components/shared/ToastContainer'

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'search',    label: 'Search',    icon: Search },
  { id: 'propose',   label: 'Propose',   icon: FileText },
  { id: 'assess',    label: 'Assess',    icon: Scale },
  { id: 'summary',   label: 'Summary',   icon: CheckSquare },
]

export default function App() {
  useAgentSocket()
  const { activeTab, setActiveTab } = useBidStore()

  return (
    <div className="h-screen flex flex-col bg-primary">
      <ToastContainer />
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Tab Bar */}
          <div className="flex border-b border-slate-600/20 bg-secondary/60">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-6 py-3.5 text-sm font-medium transition-all border-b-2 ${
                  activeTab === id
                    ? 'text-cyan-300 border-cyan-400 bg-card/40'
                    : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-card/20'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'dashboard' && <DashboardTab />}
            {activeTab === 'search' && <SearchTab />}
            {activeTab === 'propose' && <ProposalTab />}
            {activeTab === 'assess' && <AssessmentTab />}
            {activeTab === 'summary' && <SummaryTab />}
          </div>

          <AgentStatusBar />
        </main>
      </div>
    </div>
  )
}
