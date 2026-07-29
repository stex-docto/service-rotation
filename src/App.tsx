import { HashRouter as Router, Route, Routes } from 'react-router-dom'
import { Container, Flex } from '@chakra-ui/react'
import { UI_Provider } from '@presentation/ui/UI_Provider'
import { DependencyProvider } from '@presentation/context/DependencyProvider'
import Header from '@presentation/components/Header'
import Footer from '@presentation/components/Footer'
import HomePage from '@presentation/pages/HomePage'
import CreateGroupPage from '@presentation/pages/CreateGroupPage'
import GroupPage from '@presentation/pages/GroupPage'

function App() {
    return (
        <UI_Provider>
            <DependencyProvider>
                <Router>
                    <Flex direction="column" minH="100vh">
                        <Header />
                        <Container as="main" flex="1" maxW="960px" mx="auto" py={6}>
                            <Routes>
                                <Route path="/" element={<HomePage />} />
                                <Route path="/create" element={<CreateGroupPage />} />
                                <Route path="/group/:groupId" element={<GroupPage />} />
                            </Routes>
                        </Container>
                        <Footer />
                    </Flex>
                </Router>
            </DependencyProvider>
        </UI_Provider>
    )
}

export default App
