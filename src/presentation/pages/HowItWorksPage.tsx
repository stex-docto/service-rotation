import { Box, Heading, Link, Text, VStack } from '@chakra-ui/react'

export default function HowItWorksPage() {
    return (
        <VStack gap={8} align="stretch" py={4}>
            <Heading size="lg">
                Comment ça marche, et pourquoi vous pouvez voter en toute confiance
            </Heading>

            <Box>
                <Heading size="md" mb={2}>
                    L'objectif
                </Heading>
                <Text>
                    Répartir les internes entre les services de stage, rotation après rotation, de
                    la façon la plus juste possible pour tout le monde : d'abord s'assurer que la
                    moins bonne note attribuée à quelqu'un soit la plus faible possible, puis, à
                    égalité sur ce point, minimiser la somme des notes de tout le monde.
                </Text>
            </Box>

            <Box>
                <Heading size="md" mb={2}>
                    Le principe : vote à l'aveugle, calcul transparent
                </Heading>
                <VStack gap={3} align="stretch">
                    <Text>
                        <Text as="span" fontWeight="semibold">
                            Vous notez chaque service
                        </Text>{' '}
                        sur une échelle à 4 niveaux (Excellent, Bien, Indifférent, Passable), sans
                        voir les votes des autres — votre note reflète simplement ce que vous
                        ressentez, rien d'autre.
                    </Text>
                    <Text>
                        <Text as="span" fontWeight="semibold">
                            Une fois votre propre vote verrouillé
                        </Text>
                        , vous pouvez lire les votes de tout le monde et recalculer vous-même le
                        résultat, à tout moment. Rien n'est caché : c'est vérifiable par n'importe
                        qui, à partir des mêmes données.
                    </Text>
                    <Text>
                        <Text as="span" fontWeight="semibold">
                            Le tirage au sort qui départage les ex æquo
                        </Text>{' '}
                        n'est décidé par personne : il est calculé à partir du contenu de tous les
                        votes, une fois qu'ils sont tous verrouillés. Personne — pas même
                        l'organisateur — ne peut influencer cet ordre.
                    </Text>
                </VStack>
            </Box>

            <Box>
                <Heading size="md" mb={2}>
                    Bonne nouvelle : être honnête, c'est déjà la meilleure stratégie
                </Heading>
                <Text mb={3}>
                    On pourrait se demander s'il vaut mieux exagérer ses votes (ne noter que «
                    j'adore » ou « je déteste », sans jamais utiliser les niveaux intermédiaires)
                    pour essayer d'obtenir un meilleur résultat. On a vérifié, sur 1000 situations
                    simulées, en comparant à chaque fois ce que la personne obtient réellement (pas
                    ce qu'elle prétend ressentir) :
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
                <Text colorPalette="gray" fontSize="sm">
                    Vos notes intermédiaires sont ce qui permet à l'algorithme de repérer votre vrai
                    favori en cas d'égalité, et de vous proposer un compromis acceptable si votre
                    premier choix n'est pas disponible. Les exagérer, c'est se priver soi-même de
                    cette marge de manœuvre — la note qui correspond le mieux à ce que vous
                    ressentez vraiment est aussi, statistiquement, votre meilleur choix.
                </Text>
            </Box>

            <Box>
                <Heading size="md" mb={2}>
                    Une précision, pour être complet
                </Heading>
                <Text>
                    Un résultat théorique (Zhou, 1990) montre qu'aucun mécanisme ne peut être à la
                    fois parfaitement efficace, juste, et totalement insensible à toute stratégie.
                    Ce système privilégie l'efficacité et la justice, et récupère l'essentiel de
                    l'honnêteté — pas dans 100 % des cas imaginables, mais dans l'immense majorité
                    des situations réelles, comme le montre le test ci-dessus.
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
