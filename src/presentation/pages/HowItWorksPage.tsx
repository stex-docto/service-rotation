import { Box, Heading, Link, Text, VStack } from '@chakra-ui/react'

export default function HowItWorksPage() {
    return (
        <VStack gap={8} align="stretch" py={4}>
            <Heading size="lg">Comment ça marche</Heading>

            <Box>
                <Heading size="md" mb={2}>
                    L'objectif
                </Heading>
                <Text>
                    Répartir les externes entre les services de stage, rotation après rotation, de
                    la façon la plus juste possible pour tout le monde : d'abord s'assurer que
                    personne ne reçoive un service nettement pire que les autres, puis, à ce niveau
                    de qualité garanti pour tous, essayer de rapprocher chacun de ses services
                    préférés.
                </Text>
            </Box>

            <Box>
                <Heading size="md" mb={2}>
                    Le principe : notes à l'aveugle, calcul transparent
                </Heading>
                <VStack gap={3} align="stretch">
                    <Text>
                        Tu notes chaque service sur une échelle à 4 niveaux (Excellent, Bien,
                        Indifférent, Passable), sans voir les notes des autres.
                    </Text>
                    <Text>Ta note reflète simplement ce que tu ressens, rien d'autre.</Text>
                    <Text>
                        Une fois tes propres notes verrouillées, tu peux lire les notes de tout le
                        monde et recalculer toi-même le résultat, à tout moment. Rien n'est caché :
                        c'est vérifiable par n'importe qui, à partir des mêmes données.
                    </Text>
                    <Text>
                        Le tirage au sort qui départage les ex æquo n'est décidé par personne : il
                        est calculé à partir du contenu de toutes les notes, une fois qu'elles sont
                        toutes verrouillées. Personne — pas même l'organisateur — ne peut influencer
                        cet ordre.
                    </Text>
                </VStack>
            </Box>

            <Box>
                <Heading size="md" mb={2}>
                    Bonne nouvelle : être honnête, c'est déjà la meilleure stratégie
                </Heading>
                <Text mb={3}>
                    On pourrait se demander s'il vaut mieux exagérer ses notes (ne noter que «
                    j'adore » ou « je déteste », sans jamais utiliser les niveaux intermédiaires)
                    pour essayer d'obtenir un meilleur résultat. On a vérifié, sur 1000 situations
                    simulées :
                </Text>
                <VStack gap={1} align="stretch" mb={3} pl={2}>
                    <Text>
                        — Ça n'aide vraiment que dans{' '}
                        <Text as="span" fontWeight="bold">
                            moins de 1 % des cas
                        </Text>
                        .
                    </Text>
                    <Text>
                        — Ça se retourne contre soi dans{' '}
                        <Text as="span" fontWeight="bold">
                            plus de 40 % des cas
                        </Text>
                        .
                    </Text>
                </VStack>
                <Text>
                    Tes notes intermédiaires sont ce qui permet à l'algorithme de repérer ton vrai
                    favori en cas d'égalité, et de te proposer un compromis acceptable si ton
                    premier choix n'est pas disponible. Les exagérer, c'est te priver toi-même de
                    cette marge de manœuvre — la note qui correspond le mieux à ce que tu ressens
                    vraiment est aussi, statistiquement, ton meilleur choix.
                </Text>
            </Box>

            <Box>
                <Heading size="md" mb={2}>
                    Une précision, pour être complet
                </Heading>
                <Text>
                    Un résultat théorique (Zhou, 1990) montre qu'aucun mécanisme ne peut être à la
                    fois parfaitement efficace, juste, et totalement insensible à toute stratégie.
                    Le critère de justice utilisé ici — d'abord le sort du moins bien loti, la somme
                    ne servant qu'à départager — porte un nom : le critère maximin (ou rawlsien,
                    d'après le philosophe John Rawls, 1971). Ce système privilégie l'efficacité et
                    ce critère, et récupère l'essentiel de l'honnêteté — pas dans 100 % des cas
                    imaginables, mais dans l'immense majorité des situations réelles, comme le
                    montre le test ci-dessus.
                </Text>
            </Box>

            <Box>
                <Heading size="md" mb={2}>
                    Le code est public
                </Heading>
                <Text>
                    Rien ici n'est à prendre sur parole : l'algorithme, ses tests — y compris{' '}
                    <Link
                        href="https://github.com/stex-docto/service-rotation/blob/main/src/domain/matching/gamingResistance.test.ts"
                        target="_blank"
                        rel="noopener noreferrer"
                        colorPalette="blue"
                    >
                        celui cité plus haut
                    </Link>{' '}
                    — et cette page elle-même sont dans le dépôt public.{' '}
                    <Link
                        href="https://github.com/stex-docto/service-rotation"
                        target="_blank"
                        rel="noopener noreferrer"
                        colorPalette="blue"
                    >
                        Voir le code source
                    </Link>
                    .
                </Text>
            </Box>
        </VStack>
    )
}
