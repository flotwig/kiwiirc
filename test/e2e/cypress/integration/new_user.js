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

    it('Connects to an IRC network, autojoins channel', function() {
        cy.get('.kiwi-header-name').contains('###cypress-test-runner')
    })

    it('Can compose and send a message', function() {
        cy.get('.kiwi-ircinput-editor').click().type('Test message 123{enter}')
    })

    it('Receives the message back from the IRC server', function() {
        cy.contains('Test message 123')
    })
})