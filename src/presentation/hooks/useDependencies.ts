import { useContext } from 'react'
import { Dependencies } from '../context/DependencyContext'

export function useDependencies() {
    const context = useContext(Dependencies)
    if (context === undefined) {
        throw new Error('useDependencies must be used within a DependencyProvider')
    }
    return context
}
