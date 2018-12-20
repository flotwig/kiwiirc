describe('New User Walkthrough', function() {
    it('Visits KiwiIRC', function() {
        cy.visit('http://localhost:8080')
    })

    it('Can try to connect', function() {
        cy.get('.kiwi-welcome-simple-nick.u-input-text > input')
          .clear().type('cypress-test-runner')
        
        cy.get('.kiwi-welcome-simple-channel.u-input-text > input')
          .clear().type('###cypress-test-runner')

        cy.get('button.kiwi-welcome-simple-start').click()
    }) 

    it('Connects to an IRC network', function() {
        cy.contains('Connected to Network!')
    })

    it('Autojoins and shows the channel', function() {
        cy.contains('wolfe.freenode.net sets +n on ###cypress-test-runner')
    })
})