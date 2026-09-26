import { useState } from 'react'
import { useAuth } from './context/AuthContext'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { ProductsPage } from './pages/ProductsPage'
import { OperationsPage } from './pages/OperationsPage'
import { MoveHistoryPage } from './pages/MoveHistoryPage'
import { WarehousesPage } from './pages/WarehousesPage'
import { Navbar } from './components/layout/Navbar'
import { AlertsPanel } from './components/layout/AlertsPanel'

type Tab = 'dashboard' | 'products' | 'operations' | 'history' | 'warehouses'

export default function App() {
  const { isAuthenticated, loading, isManager } = useAuth()
  const [currentTab, setCurrentTab] = useState<Tab>('dashboard')
  const [operationsExtra, setOperationsExtra] = useState<any>(null)
  const [alertsPanelOpen, setAlertsPanelOpen] = useState(false)
  const [reorderAlertsCount, setReorderAlertsCount] = useState(0)

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-14 h-14">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-emerald-400 animate-pulse" />
            <div className="absolute inset-1 rounded-xl bg-slate-950 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
          <p className="text-sm text-slate-400 font-medium animate-pulse">Initializing StockSense…</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  const handleNavigate = (tab: string, extra?: any) => {
    setCurrentTab(tab as Tab)
    if (extra) setOperationsExtra(extra)
  }

  const renderPage = () => {
    switch (currentTab) {
      case 'dashboard':
        return (
          <DashboardPage
            onNavigate={handleNavigate}
          />
        )
      case 'products':
        return <ProductsPage />
      case 'operations':
        return (
          <OperationsPage
            initialExtra={operationsExtra}
            onExtraConsumed={() => setOperationsExtra(null)}
          />
        )
      case 'history':
        return <MoveHistoryPage />
      case 'warehouses':
        return isManager ? <WarehousesPage /> : (
          <div className="flex items-center justify-center h-64 text-slate-400">
            Access denied: Warehouse management requires Inventory Manager role.
          </div>
        )
      default:
        return <DashboardPage onNavigate={handleNavigate} />
    }
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Ambient gradient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-emerald-600/5 rounded-full blur-3xl" />
      </div>

      <Navbar
        currentTab={currentTab}
        setCurrentTab={(tab) => setCurrentTab(tab as Tab)}
        reorderAlertsCount={reorderAlertsCount}
        onOpenAlerts={() => setAlertsPanelOpen(true)}
      />

      <main
        className="relative max-w-7xl mx-auto px-4 lg:px-8 py-6"
        role="main"
      >
        {renderPage()}
      </main>

      {alertsPanelOpen && (
        <AlertsPanel
          onClose={() => setAlertsPanelOpen(false)}
          onNavigate={handleNavigate}
          onCountUpdate={setReorderAlertsCount}
        />
      )}
    </div>
  )
}
