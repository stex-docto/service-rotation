import { Box, Heading, Link, Text, VStack } from '@chakra-ui/react'

export default function HowItWorksPage() {
    return (
        <VStack gap={8} align="stretch" py={4}>
            <Heading size="lg">
                Comment ça marche, et pourquoi voter honnêtement est votre meilleure stratégie
            </Heading>

            <Box>
                <Heading size="md" mb={2}>
                    L'objectif
                </Heading>
                <Text>
                    Répartir les internes entre les services de stage, rotation après rotation, de
                    la façon la plus juste possible : d'abord minimiser la pire note que quelqu'un
                    reçoit, puis, à égalité sur ce point, minimiser la somme des notes de tout le
                    monde.
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
                        voir les votes des autres — votre note reflète votre vraie préférence, pas
                        une réaction stratégique à ce que les autres ont dit.
                    </Text>
                    <Text>
                        <Text as="span" fontWeight="semibold">
                            Une fois votre propre vote verrouillé
                        </Text>
                        , vous pouvez lire les votes de tout le monde et recalculer vous-même le
                        résultat. Personne n'a besoin de faire confiance à un calcul caché : c'est
                        vérifiable par n'importe qui, à tout moment, à partir des mêmes données.
                    </Text>
                    <Text>
                        <Text as="span" fontWeight="semibold">
                            Le tirage au sort qui départage les ex æquo
                        </Text>{' '}
                        n'est décidé par personne : il est calculé à partir du contenu de tous les
                        votes verrouillés. Personne ne peut se positionner favorablement, puisque
                        l'ordre n'existe qu'une fois que tous les votes sont figés.
                    </Text>
                </VStack>
            </Box>

            <Box>
                <Heading size="md" mb={2}>
                    Essayer de « jouer » le système, ça marche ?
                </Heading>
                <Text mb={3}>
                    On a testé : un participant qui exagère ses votes (uniquement « j'adore » ou «
                    je déteste », sans jamais utiliser les niveaux intermédiaires) obtient-il un
                    meilleur résultat qu'en votant honnêtement ?
                </Text>
                <Text mb={3}>
                    Sur 1000 situations aléatoires simulées, en comparant à chaque fois ce que la
                    personne obtient réellement (pas ce qu'elle prétend ressentir) :
                </Text>
                <VStack gap={1} align="stretch" mb={3} pl={2}>
                    <Text>
                        — Ça l'aide vraiment dans{' '}
                        <Text as="span" fontWeight="bold">
                            moins de 1 % des cas
                        </Text>
                        .
                    </Text>
                    <Text>
                        — Ça se retourne contre elle dans{' '}
                        <Text as="span" fontWeight="bold">
                            plus de 40 % des cas
                        </Text>{' '}
                        — plus de 50 fois plus souvent que ça ne l'aide.
                    </Text>
                </VStack>
                <Text colorPalette="gray" fontSize="sm">
                    En écrasant ses nuances (un « bien » maquillé en faux « excellent »), on efface
                    l'information qui permet à l'algorithme de repérer son vrai favori en cas
                    d'égalité, et on perd le compromis « acceptable » qu'on aurait pu offrir si son
                    premier choix n'est pas disponible.
                </Text>
            </Box>

            <Box>
                <Heading size="md" mb={2}>
                    Ce n'est pas une garantie absolue
                </Heading>
                <Text>
                    Un résultat théorique (Zhou, 1990) dit qu'aucun mécanisme ne peut être à la fois
                    efficace, juste, et totalement à l'épreuve de la triche. Ce système choisit
                    l'efficacité et la justice, et récupère l'essentiel — pas la totalité — de
                    l'honnêteté : dans des cas particuliers, exagérer un écart peut légèrement
                    aider. Mais comme le montre le test ci-dessus, l'honnêteté reste la meilleure
                    stratégie dans l'immense majorité des situations.
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
